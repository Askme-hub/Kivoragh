// Solid filled e-commerce glyphs (inspired by the user's chosen icon sheets).
// All use currentColor so they follow theme colours and dark mode.
type P = { size?: number; className?: string };
const S = ({ size = 24, className = "", children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">{children}</svg>
);

export const HomeSolid = (p: P) => <S {...p}><path d="M11.3 2.3a1 1 0 0 1 1.4 0l9 8.4a1 1 0 0 1-.7 1.8H20V21a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-8.5H3a1 1 0 0 1-.7-1.8l9-8.4Z"/></S>;
export const GridSolid = (p: P) => <S {...p}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></S>;
export const CartSolid = (p: P) => <S {...p}><path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h2a1 1 0 0 1 1 .8l.4 1.7h15.1a1 1 0 0 1 1 1.2l-1.6 7.5a1.5 1.5 0 0 1-1.5 1.2H8.2l.3 1.6H19a1 1 0 1 1 0 2H7.7a1 1 0 0 1-1-.8L3.7 4.5H2.5a1 1 0 0 1-1-1Z"/><circle cx="9" cy="20.5" r="1.8"/><circle cx="17.5" cy="20.5" r="1.8"/></S>;
export const UserSolid = (p: P) => <S {...p}><circle cx="12" cy="7.5" r="5"/><path d="M2.5 21c0-4.4 4.3-7.5 9.5-7.5s9.5 3.1 9.5 7.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1Z"/></S>;
export const TruckSolid = (p: P) => <S {...p}><path d="M1 5.5A1.5 1.5 0 0 1 2.5 4h11A1.5 1.5 0 0 1 15 5.5V7h3.4a1.5 1.5 0 0 1 1.2.6l2.9 3.8c.3.3.5.7.5 1.1v3.5a1.5 1.5 0 0 1-1.5 1.5h-.6a3 3 0 0 0-5.8 0H9.4a3 3 0 0 0-5.8 0H2.5A1.5 1.5 0 0 1 1 16V5.5Zm15 3.5v3h4.6L18.3 9H16Z"/><circle cx="6.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/></S>;
export const WalletSolid = (p: P) => <S {...p}><path d="M4 4h14a2 2 0 0 1 2 2v1H5a1 1 0 0 0 0 2h15.5A1.5 1.5 0 0 1 22 10.5v8A2.5 2.5 0 0 1 19.5 21h-15A2.5 2.5 0 0 1 2 18.5v-12A2.5 2.5 0 0 1 4 4Zm13 9.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></S>;
export const BoxSearchSolid = (p: P) => <S {...p}><path d="M11 1.5 20 6v5.2A6.5 6.5 0 0 0 11.6 21L2 16V6l9-4.5ZM5 7l6 3 6-3-6-3-6 3Z"/><path d="M17 12.5a4.5 4.5 0 0 1 3.7 7.1l1.6 1.6a1 1 0 0 1-1.4 1.4l-1.6-1.6A4.5 4.5 0 1 1 17 12.5Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/></S>;
export const BagSolid = (p: P) => <S {...p}><path d="M8 7V6a4 4 0 0 1 8 0v1h3a1 1 0 0 1 1 .9l1 13A1 1 0 0 1 20 22H4a1 1 0 0 1-1-1.1l1-13A1 1 0 0 1 5 7h3Zm2 0h4V6a2 2 0 1 0-4 0v1Zm-1 4a1 1 0 1 0-2 0 5 5 0 0 0 10 0 1 1 0 1 0-2 0 3 3 0 0 1-6 0Z"/></S>;
export const ChatSolid = (p: P) => <S {...p}><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-4.4 3.5A1 1 0 0 1 3 20.7V5a2 2 0 0 1 1-2Zm3 5a1 1 0 0 0 0 2h10a1 1 0 1 0 0-2H7Zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z"/></S>;

/** Customer care agent with headset (support avatar). */
export function SupportAgent({ size = 32, className = "" }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="currentColor" opacity=".18"/>
      <path d="M10 44c1.5-7 7-11 14-11s12.5 4 14 11a23.9 23.9 0 0 1-28 0Z" fill="currentColor"/>
      <circle cx="24" cy="20" r="8.5" fill="currentColor"/>
      <path d="M14 21a10 10 0 0 1 20 0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
      <rect x="11.5" y="19" width="4.5" height="7" rx="2" fill="currentColor"/>
      <rect x="32" y="19" width="4.5" height="7" rx="2" fill="currentColor"/>
      <path d="M34 26c0 3.5-3 5.5-7 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="26" cy="31.5" r="1.7" fill="currentColor"/>
    </svg>
  );
}
