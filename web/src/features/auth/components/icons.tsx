import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const UserIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="8" r="4" /><path d="M4.8 20c.7-4 3-6 7.2-6s6.5 2 7.2 6" /></Icon>;
export const LockIcon = (props: IconProps) => <Icon {...props}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>;
export const EyeIcon = (props: IconProps) => <Icon {...props}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></Icon>;
export const EyeOffIcon = (props: IconProps) => <Icon {...props}><path d="m3 3 18 18M10.6 6.2c.5-.1.9-.2 1.4-.2 6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.8M6.5 6.6C4 8.2 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6M9.9 9.9a3 3 0 0 0 4.2 4.2" /></Icon>;
export const ArrowRightIcon = (props: IconProps) => <Icon {...props}><path d="M5 12h14M14 7l5 5-5 5" /></Icon>;
export const ArrowLeftIcon = (props: IconProps) => <Icon {...props}><path d="M19 12H5M10 7l-5 5 5 5" /></Icon>;
export const MailIcon = (props: IconProps) => <Icon {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></Icon>;
export const SendIcon = (props: IconProps) => <Icon {...props}><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></Icon>;
export const CheckIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16.5 9" /></Icon>;
export const AlertIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></Icon>;
export const KeyIcon = (props: IconProps) => <Icon {...props}><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l2 2M14 9l2 2" /></Icon>;
export const LogoutIcon = (props: IconProps) => <Icon {...props}><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" /></Icon>;
