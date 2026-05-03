require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

// Note: Using native Node.js fetch (available in Node 18+)
// No need to import fetch - it's global

const app = express();

// Enable CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(bodyParser.json());

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_API_SECRET,
  RESEND_API_KEY,
  EMAIL_FROM,
  RESEND_FROM_EMAIL,
  APP_BASE_URL,
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  PORT = 3000
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_API_SECRET) {
  console.error('Missing required environment variables. See .env.example');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

function getResendFromEmail() {
  return EMAIL_FROM || RESEND_FROM_EMAIL || '';
}

function getAppBaseUrl() {
  return String(APP_BASE_URL || '').trim().replace(/\/+$/, '');
}

function getAuthCallbackUrl() {
  const baseUrl = getAppBaseUrl();
  return baseUrl ? `${baseUrl}/auth/callback` : '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizePhoneNumber(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (trimmed.startsWith('+')) {
    return `+${digits}`;
  }

  if (digits.startsWith('233') && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `+233${digits.slice(1)}`;
  }

  return digits.length >= 10 ? `+${digits}` : digits;
}

async function generateVerificationLink(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return '';
  }

  const redirectTo = getAuthCallbackUrl();
  const { data, error } = await supa.auth.admin.generateLink({
    type: 'invite',
    email: normalizedEmail,
    options: redirectTo ? { redirectTo } : undefined
  });

  if (error) {
    throw new Error(error.message || 'Could not generate verification link.');
  }

  return data?.properties?.action_link || '';
}

function buildEmailHtml({ safeName, safeLink, fallbackUrl, hasLink }) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #0f172a; background: #f8fafc; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
        <p style="margin: 0 0 8px; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; color: #475569;">BatchCommerce</p>
        <h2 style="margin: 0 0 12px; font-size: 24px; line-height: 1.3; color: #0f172a;">Verify Your Email</h2>
        <p style="margin: 0 0 12px;">Hello ${safeName},</p>
        <p style="margin: 0 0 12px;">Your account was created successfully. Confirm your email address to activate your account.</p>
        ${hasLink ? `<p style="margin: 20px 0;"><a href="${safeLink}" style="display:inline-block;padding:12px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Verify Email</a></p>` : ''}
        ${hasLink ? `<p style="margin: 0 0 12px; font-size: 13px; color: #475569;">If the button does not work, copy and paste this link in your browser:</p><p style="margin: 0 0 16px; word-break: break-all;"><a href="${safeLink}" style="color:#2563eb;">${safeLink}</a></p>` : ''}
        ${!hasLink && fallbackUrl ? `<p style="margin: 0 0 12px;">Open <a href="${fallbackUrl}" style="color:#2563eb;">${fallbackUrl}</a> and continue verification from the sign-in screen.</p>` : ''}
        <p style="margin: 0; color: #475569;">If you did not request this account, you can ignore this email.</p>
      </div>
    </div>
  `;
}

async function sendVerificationEmail({ email, fullName, verificationLink }) {
  const safeName = escapeHtml(fullName || 'there');
  const safeLink = escapeHtml(verificationLink || '');
  const fallbackUrl = escapeHtml(getAppBaseUrl() || '');
  const hasLink = Boolean(safeLink);
  const plainFallbackUrl = getAppBaseUrl() || '';
  const subject = 'Verify your BatchCommerce account';
  const textBody = [
    `Hello ${fullName || 'there'},`,
    '',
    'Your BatchCommerce account was created successfully.',
    'Please verify your email address to activate your account.',
    hasLink ? `Verify now: ${verificationLink}` : '',
    !hasLink && plainFallbackUrl ? `Open this app and continue verification: ${plainFallbackUrl}` : '',
    '',
    'If you did not request this, you can ignore this email.'
  ].filter(Boolean).join('\n');
  const html = buildEmailHtml({ safeName, safeLink, fallbackUrl, hasLink });

  // --- Gmail (nodemailer) path ---
  if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s+/g, '') }
    });
    await transporter.sendMail({
      from: `BatchCommerce <${GMAIL_USER}>`,
      to: email,
      subject,
      text: textBody,
      html
    });
    console.log(`✅ Verification email sent via Gmail to ${email}`);
    return true;
  }

  // --- Resend fallback ---
  if (!RESEND_API_KEY || !getResendFromEmail()) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: getResendFromEmail(),
      to: [email],
      subject,
      text: textBody,
      html
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Resend request failed (${response.status}): ${errorText}`);
  }

  console.log(`✅ Verification email sent via Resend to ${email}`);
  return true;
}

async function createAuthAndAppUser({
  email,
  password,
  full_name,
  phone = '',
  roleId,
  autoConfirm = true,
  username,
  createAppUser = true
}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = normalizePhoneNumber(phone);
  const authPayload = {
    password,
    user_metadata: { full_name, phone: normalizedPhone, username: username || undefined }
  };

  if (normalizedEmail) {
    authPayload.email = normalizedEmail;
    authPayload.email_confirm = autoConfirm;
  }

  if (normalizedPhone) {
    authPayload.phone = normalizedPhone;
    authPayload.phone_confirm = autoConfirm;
  }

  const { data: authData, error: authError } = await supa.auth.admin.createUser(authPayload);

  if (authError) {
    console.error('❌ Supabase Auth API rejected request:');
    console.error('Error:', JSON.stringify(authError, null, 2));

    if (authError.code === 'email_exists' || authError.message?.toLowerCase().includes('email exists')) {
      return {
        ok: false,
        status: 409,
        body: {
          error: 'user_exists',
          detail: 'This email is already registered. Please sign in instead.'
        }
      };
    }

    if (authError.code === 'phone_exists' || authError.message?.toLowerCase().includes('phone')) {
      return {
        ok: false,
        status: 409,
        body: {
          error: 'user_exists',
          detail: 'This phone number is already registered. Please sign in instead.'
        }
      };
    }

    return { ok: false, status: 400, body: { error: 'supabase_auth_error', detail: authError } };
  }

  const authUser = authData?.user;
  const authId = authUser?.id;

  if (!authId) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'supabase_auth_error',
        detail: 'Auth user creation succeeded but returned no user ID.'
      }
    };
  }

  if (!createAppUser) {
    return { ok: true, body: { success: true, authUserId: authId } };
  }

  const uname = username || (normalizedEmail.includes('@') ? normalizedEmail.split('@')[0] : normalizedPhone || 'user');

  const { data: existingUser } = await supa.from('app_users')
    .select('id')
    .eq('username', uname)
    .single();

  if (existingUser) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'user_exists',
        detail: `User with username "${uname}" already exists`
      }
    };
  }

  const { data, error } = await supa.from('app_users').insert({
    auth_id: authId,
    username: uname,
    full_name,
    phone: normalizedPhone,
    email: normalizedEmail || null,
    is_active: true
  }).select('id').single();

  if (error) {
    console.error('❌ App users insert failed:', error);
    console.error('Attempted to insert: auth_id=', authId, 'username=', uname);

    try {
      const deleteRes = await fetch(`${SUPABASE_URL.replace(/\/\/$/, '')}/auth/v1/admin/users/${authId}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
      });
      if (deleteRes.ok) {
        console.log('✅ Cleaned up auth user after app_users insert failure');
      }
    } catch (cleanupErr) {
      console.error('⚠️ Failed to cleanup auth user:', cleanupErr);
    }

    return { ok: false, status: 500, body: { error: 'db_insert_error', detail: error.message } };
  }

  return { ok: true, body: { success: true, appUserId: data.id, authUserId: authId } };
}

// Simple header-based protection: require `Authorization: Bearer <ADMIN_API_SECRET>`
function requireAdminAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== ADMIN_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/admin/create-user', requireAdminAuth, async (req, res) => {
  try {
    const { email, password, full_name, phone = '', roleId, autoConfirm = true, username } = req.body;
    if ((!email && !phone) || !password || !full_name) {
      return res.status(400).json({ error: 'email_or_phone,password,full_name required' });
    }
    const result = await createAuthAndAppUser({ email, password, full_name, phone, roleId, autoConfirm, username });
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const wantsVerification = Boolean(normalizedEmail) && !autoConfirm;
    let verificationSent = false;
    let verificationMessage = '';

    if (wantsVerification) {
      try {
        const verificationLink = await generateVerificationLink(normalizedEmail);
        verificationSent = await sendVerificationEmail({
          email: normalizedEmail,
          fullName: full_name,
          verificationLink
        });
        verificationMessage = verificationSent
          ? `Verification email sent to ${normalizedEmail}.`
          : 'User created, but verification email could not be sent because Resend is not fully configured.';
      } catch (mailErr) {
        verificationMessage = 'User created, but verification email could not be sent.';
        console.warn('Verification email send failed:', mailErr?.message || mailErr);
      }
    }

    return res.json({
      ...result.body,
      membershipStatus: wantsVerification ? 'pending_verification' : 'active',
      verificationSent,
      verificationMessage
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', detail: String(err) });
  }
});

app.post('/public/register', async (req, res) => {
  try {
    const { email, password, full_name, phone = '', username } = req.body;
    if (!email || !password || !full_name || !phone) {
      return res.status(400).json({ error: 'email,password,full_name,phone required' });
    }

    const result = await createAuthAndAppUser({
      email,
      password,
      full_name,
      phone,
      roleId: null,
      autoConfirm: false,
      username: username || undefined,
      createAppUser: false
    });

    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    let emailSent = false;
    let emailError = '';
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const verificationLink = await generateVerificationLink(normalizedEmail);
      emailSent = await sendVerificationEmail({
        email: normalizedEmail,
        fullName: full_name.trim(),
        verificationLink
      });
    } catch (mailErr) {
      emailError = String(mailErr?.message || mailErr || 'Email send failed');
      console.warn('Signup email could not be sent:', emailError);
    }

    return res.json({ ...result.body, emailSent, emailError: emailSent ? undefined : emailError || 'Email sender is not configured.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', detail: String(err) });
  }
});

app.delete('/admin/delete-user/:authId', requireAdminAuth, async (req, res) => {
  try {
    const { authId } = req.params;
    if (!authId) return res.status(400).json({ error: 'authId required' });

    // Step 1: Delete app_users row first (FK prevents deleting auth user while it still references it)
    const { error: appUserError } = await supa.from('app_users').delete().eq('auth_id', authId);
    if (appUserError) {
      console.error('❌ Failed to delete app_users row:', appUserError);
      return res.status(400).json({ error: 'delete_failed', detail: appUserError });
    }

    // Step 2: Now delete the auth user
    const { error: authError } = await supa.auth.admin.deleteUser(authId);
    if (authError) {
      console.error('❌ Failed to delete auth user:', authError);
      return res.status(400).json({ error: 'delete_failed', detail: authError });
    }

    console.log(`✅ User fully deleted: ${authId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', detail: String(err) });
  }
});

app.post('/admin/update-batch-product-price', requireAdminAuth, async (req, res) => {
  try {
    const { batchProductId, preorderPrice, stockPrice, actorUserId } = req.body;
    
    if (!batchProductId) {
      return res.status(400).json({ error: 'batchProductId required' });
    }

    // 1) Get the batch_product and find all related orders
    const { data: batchProduct, error: bpError } = await supa
      .from('batch_products')
      .select('id, batch_id, product_id, preorder_price, stock_price')
      .eq('id', batchProductId)
      .single();

    if (bpError || !batchProduct) {
      return res.status(404).json({ error: 'batch_product not found' });
    }

    const oldPreorderPrice = batchProduct.preorder_price;
    const oldStockPrice = batchProduct.stock_price;

    // 2) Update the batch_product prices
    const { error: updateError } = await supa
      .from('batch_products')
      .update({
        preorder_price: preorderPrice !== undefined ? preorderPrice : oldPreorderPrice,
        stock_price: stockPrice !== undefined ? stockPrice : oldStockPrice
      })
      .eq('id', batchProductId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update batch_product', detail: updateError });
    }

    // 3) Find all order_items using this batch_product and get their orders
    const { data: orderItems, error: oiError } = await supa
      .from('order_items')
      .select('id, order_id, quantity, batch_product_id')
      .eq('batch_product_id', batchProductId);

    if (oiError) {
      return res.status(500).json({ error: 'Failed to fetch order_items', detail: oiError });
    }

    // 4) Update all affected order_items with new unit_price
    const newPrice = preorderPrice !== undefined ? preorderPrice : oldPreorderPrice;
    let affectedOrderCount = 0;

    if (orderItems && orderItems.length > 0) {
      const orderIds = [...new Set(orderItems.map(oi => oi.order_id))];
      affectedOrderCount = orderIds.length;

      // Batch update all order items
      for (const item of orderItems) {
        const newSubtotal = +(item.quantity * newPrice).toFixed(2);
        await supa
          .from('order_items')
          .update({
            unit_price: newPrice,
            subtotal: newSubtotal
          })
          .eq('id', item.id);
      }

      // Log this price change in audit_log
      if (actorUserId) {
        await supa.from('audit_log').insert({
          actor_user_id: actorUserId,
          action: 'UPDATE_BATCH_PRODUCT_PRICE',
          entity_table: 'batch_products',
          entity_id: batchProductId,
          before_data: {
            preorder_price: oldPreorderPrice,
            stock_price: oldStockPrice
          },
          after_data: {
            preorder_price: preorderPrice !== undefined ? preorderPrice : oldPreorderPrice,
            stock_price: stockPrice !== undefined ? stockPrice : oldStockPrice
          },
          metadata: {
            affected_orders: affectedOrderCount,
            order_ids: orderIds
          }
        });
      }
    }

    return res.json({
      success: true,
      affectedOrderCount,
      message: `Price updated. ${affectedOrderCount} order(s) recalculated.`
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', detail: String(err) });
  }
});

// Calculate orders that will be affected by a price change (for preview)
app.post('/admin/preview-price-change', requireAdminAuth, async (req, res) => {
  try {
    const { batchProductId, newPrice } = req.body;
    
    if (!batchProductId || newPrice === undefined) {
      return res.status(400).json({ error: 'batchProductId and newPrice required' });
    }

    // Get batch_product info
    const { data: batchProduct } = await supa
      .from('batch_products')
      .select('id, batch_id, product_id, product:product_id(name), preorder_price')
      .eq('id', batchProductId)
      .single();

    if (!batchProduct) {
      return res.status(404).json({ error: 'batch_product not found' });
    }

    // Find affected orders
    const { data: orderItems } = await supa
      .from('order_items')
      .select('id, order_id, quantity, unit_price, subtotal')
      .eq('batch_product_id', batchProductId);

    if (!orderItems || orderItems.length === 0) {
      return res.json({
        batchProductId,
        productName: batchProduct.product?.name,
        currentPrice: batchProduct.preorder_price,
        newPrice,
        affectedOrdersCount: 0,
        affectedOrders: [],
        totalCostChange: 0
      });
    }

    // Calculate cost changes
    let totalCostChange = 0;
    const affectedOrderIds = new Set();
    const orderChanges = [];

    for (const item of orderItems) {
      const oldCost = item.quantity * item.unit_price;
      const newCost = item.quantity * newPrice;
      const costChange = newCost - oldCost;
      totalCostChange += costChange;
      affectedOrderIds.add(item.order_id);
      
      orderChanges.push({
        orderItemId: item.id,
        orderId: item.order_id,
        quantity: item.quantity,
        oldPrice: item.unit_price,
        newPrice,
        oldCost,
        newCost,
        costChange
      });
    }

    // Get customer info for affected orders
    const orderIdsArray = Array.from(affectedOrderIds);
    const { data: orders } = await supa
      .from('orders')
      .select('id, customer_id, customer:customer_id(name)')
      .in('id', orderIdsArray);

    return res.json({
      success: true,
      batchProductId,
      productName: batchProduct.product?.name,
      currentPrice: batchProduct.preorder_price,
      newPrice,
      affectedOrdersCount: orderIdsArray.length,
      affectedOrders: orders || [],
      totalAffectedItems: orderItems.length,
      totalCostChange: +(totalCostChange).toFixed(2),
      orderChanges
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', detail: String(err) });
  }
});

app.get('/', (req, res) => res.send('Shakhis Admin API')); 

app.listen(PORT, () => console.log(`Admin API listening on port ${PORT}`));
