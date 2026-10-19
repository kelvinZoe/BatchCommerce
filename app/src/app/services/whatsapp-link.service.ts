import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

export interface WhatsappChatLink {
  url: string;
  usesUsername: boolean;
  includesMessage: boolean;
}

@Injectable({ providedIn: 'root' })
export class WhatsappLinkService {
  constructor(private authService: AuthService) {}

  buildChatLink(phone: string | null | undefined, username: string | null | undefined, message: string): WhatsappChatLink {
    const normalizedPhone = this.authService.normalizePhoneNumber(phone || '').replace(/\D/g, '');
    if (normalizedPhone) {
      return {
        url: `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`,
        usesUsername: false,
        includesMessage: true
      };
    }

    const normalizedUsername = this.normalizeUsername(username);
    if (this.isValidUsername(normalizedUsername)) {
      return {
        url: `https://wa.me/${normalizedUsername}`,
        usesUsername: true,
        includesMessage: false
      };
    }

    return {
      url: `https://wa.me/?text=${encodeURIComponent(message)}`,
      usesUsername: false,
      includesMessage: true
    };
  }

  normalizeUsername(value: string | null | undefined): string {
    return (value || '').trim().replace(/^@+/, '').toLowerCase();
  }

  private isValidUsername(value: string): boolean {
    return value.length >= 3
      && value.length <= 35
      && /^[a-z0-9._]+$/.test(value)
      && !/^\d+$/.test(value);
  }
}
