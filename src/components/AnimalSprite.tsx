import React from 'react';
import { SpeciesId } from '../types/zoo';

interface AnimalSpriteProps {
  speciesId: SpeciesId;
  size?: number;
  facingLeft?: boolean;
  className?: string;
}

export const AnimalSprite: React.FC<AnimalSpriteProps> = ({
  speciesId,
  size = 34,
  facingLeft = false,
  className = '',
}) => {
  const flipStyle = facingLeft ? { transform: 'scaleX(-1)' } : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={flipStyle}
      className={className}
      aria-hidden="true"
    >
      {/* Subtle ground shadow */}
      <ellipse cx="24" cy="42" rx="13" ry="3.5" fill="#000000" fillOpacity="0.16" />

      {speciesId === 'giraffe' && (
        <g>
          {/* Legs */}
          <rect x="17" y="29" width="3.5" height="12" rx="1.5" fill="#E8A848" stroke="#4A3214" strokeWidth="1.5" />
          <rect x="27" y="29" width="3.5" height="12" rx="1.5" fill="#E8A848" stroke="#4A3214" strokeWidth="1.5" />
          {/* Body */}
          <ellipse cx="23" cy="28" rx="9" ry="6.5" fill="#F5C05D" stroke="#4A3214" strokeWidth="1.6" />
          {/* Neck */}
          <path d="M26 24 L29 10 L34 11 L31 27 Z" fill="#F5C05D" stroke="#4A3214" strokeWidth="1.6" strokeLinejoin="round" />
          {/* Spots */}
          <circle cx="20" cy="27" r="2.2" fill="#A65E24" />
          <circle cx="25" cy="29" r="1.8" fill="#A65E24" />
          <circle cx="30" cy="18" r="1.5" fill="#A65E24" />
          {/* Head & Ossicones */}
          <line x1="30" y1="8" x2="29" y2="4.5" stroke="#4A3214" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="33" y1="8" x2="34" y2="4.5" stroke="#4A3214" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="29" cy="4" r="1.4" fill="#A65E24" />
          <circle cx="34" cy="4" r="1.4" fill="#A65E24" />
          <ellipse cx="33" cy="10.5" rx="5.5" ry="4" fill="#F5C05D" stroke="#4A3214" strokeWidth="1.6" />
          <circle cx="33.5" cy="9.5" r="1.1" fill="#2A1C0B" />
          <circle cx="36.8" cy="10.5" r="0.9" fill="#4A3214" />
        </g>
      )}

      {speciesId === 'lion' && (
        <g>
          {/* Body */}
          <ellipse cx="21" cy="31" rx="10" ry="7" fill="#E8A338" stroke="#4A2B0D" strokeWidth="1.6" />
          {/* Tail */}
          <path d="M11 30 Q7 25 10 21" stroke="#4A2B0D" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <circle cx="10" cy="20.5" r="2.2" fill="#8C4A19" />
          {/* Legs */}
          <rect x="14" y="34" width="4" height="7" rx="1.8" fill="#E8A338" stroke="#4A2B0D" strokeWidth="1.5" />
          <rect x="25" y="34" width="4" height="7" rx="1.8" fill="#E8A338" stroke="#4A2B0D" strokeWidth="1.5" />
          {/* Mane */}
          <circle cx="29" cy="21" r="10.5" fill="#9A4D16" stroke="#4A2B0D" strokeWidth="1.6" />
          {/* Ears */}
          <circle cx="23" cy="12.5" r="2.6" fill="#E8A338" stroke="#4A2B0D" strokeWidth="1.5" />
          <circle cx="35" cy="12.5" r="2.6" fill="#E8A338" stroke="#4A2B0D" strokeWidth="1.5" />
          {/* Face */}
          <circle cx="29.5" cy="21" r="7" fill="#F7BA54" stroke="#4A2B0D" strokeWidth="1.5" />
          <circle cx="27.2" cy="19.3" r="1.8" fill="#FFFDF5" stroke="#4A2B0D" strokeWidth="0.6" />
          <circle cx="32.4" cy="19.3" r="1.8" fill="#FFFDF5" stroke="#4A2B0D" strokeWidth="0.6" />
          <circle cx="27.3" cy="19.3" r="1.05" fill="#1F1307" />
          <circle cx="32.5" cy="19.3" r="1.05" fill="#1F1307" />
          <circle cx="27.8" cy="18.8" r="0.45" fill="#FFFFFF" />
          <circle cx="33.0" cy="18.8" r="0.45" fill="#FFFFFF" />
          <polygon points="29,22 31.5,22 30.2,24" fill="#5E2C0B" />
        </g>
      )}

      {speciesId === 'zebra' && (
        <g>
          {/* Legs */}
          <rect x="15" y="31" width="3.5" height="10" rx="1.4" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.5" />
          <rect x="26" y="31" width="3.5" height="10" rx="1.4" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.5" />
          {/* Body */}
          <ellipse cx="22" cy="28" rx="10" ry="7" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.6" />
          {/* Stripes */}
          <path d="M17 22 L19 33 M21 21 L23 34 M25 22 L27 33" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
          {/* Neck & Head */}
          <path d="M27 24 L31 13 L36 14 L32 27 Z" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M27 12 L31 13 L29 20" stroke="#1E293B" strokeWidth="2.6" strokeLinecap="round" />
          <ellipse cx="34.5" cy="15" rx="6" ry="4.2" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.6" />
          <ellipse cx="38.5" cy="16" rx="2.5" ry="2.8" fill="#334155" />
          <circle cx="33.5" cy="14" r="1.1" fill="#0F172A" />
        </g>
      )}

      {speciesId === 'panda' && (
        <g>
          {/* Ears */}
          <circle cx="15" cy="12" r="4.2" fill="#1F2937" />
          <circle cx="33" cy="12" r="4.2" fill="#1F2937" />
          {/* Body */}
          <ellipse cx="24" cy="31" rx="11.5" ry="9.5" fill="#FFFFFF" stroke="#1F2937" strokeWidth="1.7" />
          {/* Shoulder band & Legs */}
          <path d="M14 27 Q24 31 34 27" stroke="#1F2937" strokeWidth="5.5" strokeLinecap="round" fill="none" />
          <ellipse cx="16" cy="38" rx="4.2" ry="3.2" fill="#1F2937" />
          <ellipse cx="32" cy="38" rx="4.2" ry="3.2" fill="#1F2937" />
          {/* Head */}
          <circle cx="24" cy="18.5" r="10" fill="#FFFFFF" stroke="#1F2937" strokeWidth="1.7" />
          {/* Eye patches */}
          <ellipse cx="19.5" cy="18" rx="3.2" ry="3.8" transform="rotate(-15 19.5 18)" fill="#1F2937" />
          <ellipse cx="28.5" cy="18" rx="3.2" ry="3.8" transform="rotate(15 28.5 18)" fill="#1F2937" />
          <circle cx="20" cy="17.5" r="1.1" fill="#FFFFFF" />
          <circle cx="28" cy="17.5" r="1.1" fill="#FFFFFF" />
          <ellipse cx="24" cy="21.5" rx="2" ry="1.3" fill="#1F2937" />
          {/* Cheek blush */}
          <circle cx="17" cy="22" r="1.6" fill="#FDA4AF" fillOpacity="0.7" />
          <circle cx="31" cy="22" r="1.6" fill="#FDA4AF" fillOpacity="0.7" />
        </g>
      )}

      {speciesId === 'red_panda' && (
        <g>
          {/* Fluffy striped tail */}
          <path d="M14 33 Q6 31 8 24 Q10 19 15 23" fill="#C2410C" stroke="#431407" strokeWidth="1.5" />
          <path d="M9 28 L13 27 M8 24 L12 24" stroke="#FDBA74" strokeWidth="2" strokeLinecap="round" />
          {/* Body */}
          <ellipse cx="23" cy="31" rx="9.5" ry="7.5" fill="#D9531E" stroke="#431407" strokeWidth="1.6" />
          <ellipse cx="24" cy="33" rx="6" ry="4" fill="#431407" />
          {/* Ears */}
          <polygon points="16,15 18,8 23,13" fill="#FFF7ED" stroke="#431407" strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="34,15 32,8 27,13" fill="#FFF7ED" stroke="#431407" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Head */}
          <ellipse cx="25" cy="19.5" rx="9.5" ry="8" fill="#EA580C" stroke="#431407" strokeWidth="1.6" />
          {/* White markings */}
          <ellipse cx="25" cy="22" rx="5.5" ry="3.8" fill="#FFF7ED" />
          <circle cx="21" cy="18" r="1.5" fill="#FFF7ED" />
          <circle cx="29" cy="18" r="1.5" fill="#FFF7ED" />
          <circle cx="21.5" cy="19" r="1.2" fill="#1C1917" />
          <circle cx="28.5" cy="19" r="1.2" fill="#1C1917" />
          <circle cx="25" cy="21.5" r="1.4" fill="#1C1917" />
        </g>
      )}

      {speciesId === 'penguin' && (
        <g>
          {/* Feet */}
          <ellipse cx="19" cy="40" rx="3.5" ry="1.8" fill="#F59E0B" stroke="#451A03" strokeWidth="1.2" />
          <ellipse cx="29" cy="40" rx="3.5" ry="1.8" fill="#F59E0B" stroke="#451A03" strokeWidth="1.2" />
          {/* Body */}
          <ellipse cx="24" cy="26" rx="10" ry="13.5" fill="#1E293B" stroke="#0F172A" strokeWidth="1.6" />
          {/* Belly */}
          <ellipse cx="24.5" cy="28" rx="6.8" ry="10.2" fill="#F8FAFC" />
          {/* King Penguin Golden Collar */}
          <path d="M18 18 Q24 22 30 18" stroke="#FBBF24" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          {/* Flippers */}
          <ellipse cx="13.5" cy="27" rx="2.5" ry="6.5" transform="rotate(14 13.5 27)" fill="#1E293B" stroke="#0F172A" strokeWidth="1.4" />
          <ellipse cx="34.5" cy="27" rx="2.5" ry="6.5" transform="rotate(-14 34.5 27)" fill="#1E293B" stroke="#0F172A" strokeWidth="1.4" />
          {/* Eyes & Beak */}
          <circle cx="21" cy="15" r="1.3" fill="#FFFFFF" />
          <circle cx="21.2" cy="15" r="0.7" fill="#0F172A" />
          <circle cx="27.5" cy="15" r="1.3" fill="#FFFFFF" />
          <circle cx="27.3" cy="15" r="0.7" fill="#0F172A" />
          <polygon points="24,16.5 29.5,18.2 24,19.8" fill="#F97316" stroke="#451A03" strokeWidth="1.1" strokeLinejoin="round" />
        </g>
      )}

      {speciesId === 'seal' && (
        <g>
          {/* Tail flipper */}
          <path d="M11 33 L5 29 L7 36 Z" fill="#64748B" stroke="#1E293B" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Body */}
          <ellipse cx="23" cy="30" rx="12.5" ry="8" fill="#94A3B8" stroke="#1E293B" strokeWidth="1.6" />
          <ellipse cx="24" cy="32.5" rx="8.5" ry="4.5" fill="#E2E8F0" />
          {/* Front flipper */}
          <ellipse cx="23" cy="34" rx="4.5" ry="2.2" transform="rotate(15 23 34)" fill="#64748B" stroke="#1E293B" strokeWidth="1.4" />
          {/* Head */}
          <circle cx="31" cy="21" r="7.5" fill="#94A3B8" stroke="#1E293B" strokeWidth="1.6" />
          <ellipse cx="33.5" cy="23" rx="3.8" ry="2.8" fill="#F1F5F9" />
          <circle cx="29" cy="19" r="1.4" fill="#0F172A" />
          <circle cx="34.5" cy="19" r="1.4" fill="#0F172A" />
          <circle cx="33.8" cy="22" r="1.2" fill="#1E293B" />
          {/* Whiskers */}
          <path d="M36 22.5 L40 21.5 M36 23.5 L40 24.5" stroke="#334155" strokeWidth="1" strokeLinecap="round" />
        </g>
      )}

      {speciesId === 'capybara' && (
        <g>
          {/* Legs */}
          <rect x="14" y="32" width="4" height="8" rx="1.6" fill="#7C4D2B" stroke="#3B2110" strokeWidth="1.4" />
          <rect x="27" y="32" width="4" height="8" rx="1.6" fill="#7C4D2B" stroke="#3B2110" strokeWidth="1.4" />
          {/* Round body */}
          <ellipse cx="22" cy="29" rx="12" ry="8.5" fill="#9C663B" stroke="#3B2110" strokeWidth="1.6" />
          {/* Blocky calm head */}
          <rect x="26" y="15" width="13.5" height="10.5" rx="4.5" fill="#A67044" stroke="#3B2110" strokeWidth="1.6" />
          {/* Small ear */}
          <circle cx="28" cy="15.5" r="2.2" fill="#7C4D2B" stroke="#3B2110" strokeWidth="1.4" />
          {/* Relaxed closed/calm eyes */}
          <path d="M31 19.5 Q32.5 18.5 34 19.5" stroke="#2D180B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <ellipse cx="37.5" cy="21.5" rx="1.4" ry="1.1" fill="#3B2110" />
          {/* Cute yuzu orange on head! */}
          <circle cx="32.5" cy="13.2" r="3" fill="#F97316" stroke="#7C2D12" strokeWidth="1.2" />
          <path d="M32.5 10.2 L34 8.5" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {speciesId === 'toucan' && (
        <g>
          {/* Tail */}
          <rect x="11" y="29" width="6" height="10" rx="2" transform="rotate(25 14 34)" fill="#1E293B" stroke="#0F172A" strokeWidth="1.4" />
          {/* Body */}
          <ellipse cx="21" cy="27" rx="8" ry="10.5" fill="#1E293B" stroke="#0F172A" strokeWidth="1.6" />
          {/* Bright throat */}
          <ellipse cx="23.5" cy="21" rx="5" ry="6" fill="#FACC15" />
          <path d="M19 25 Q24 27.5 28 24.5" stroke="#EF4444" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Huge colorful beak */}
          <path d="M26 14 Q39 14 40 21 Q32 22 26 20 Z" fill="#F97316" stroke="#0F172A" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M36 16 Q39.5 17.5 40 21 L35.5 21 Z" fill="#DC2626" />
          {/* Eye */}
          <circle cx="24.5" cy="17" r="2.2" fill="#38BDF8" />
          <circle cx="24.5" cy="17" r="1.1" fill="#0F172A" />
          {/* Feet */}
          <path d="M19 37 L19 41 M23 37 L23 41" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {speciesId === 'elephant' && (
        <g>
          <rect x="14" y="31" width="5" height="9" rx="1.6" fill="#7E8691" stroke="#334155" strokeWidth="1.4" />
          <rect x="25" y="31" width="5" height="9" rx="1.6" fill="#7E8691" stroke="#334155" strokeWidth="1.4" />
          <ellipse cx="22" cy="27" rx="11" ry="8.5" fill="#8E96A0" stroke="#334155" strokeWidth="1.5" />
          <ellipse cx="29" cy="18" rx="6.5" ry="7.5" fill="#747C86" stroke="#334155" strokeWidth="1.4" />
          <circle cx="32.5" cy="20" r="6.8" fill="#8E96A0" stroke="#334155" strokeWidth="1.5" />
          <path d="M38 22 Q43 26 40 34 Q38 35 37 32 Q39 27 35 24" fill="#8E96A0" stroke="#334155" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M35 23 Q39 25 38 28" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="33.5" cy="18.5" r="1.2" fill="#0F172A" />
        </g>
      )}

      {speciesId === 'tiger' && (
        <g>
          <path d="M12 29 Q7 24 10 20" stroke="#EA580C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <rect x="14" y="33" width="4" height="8" rx="1.5" fill="#F97316" stroke="#431407" strokeWidth="1.4" />
          <rect x="26" y="33" width="4" height="8" rx="1.5" fill="#F97316" stroke="#431407" strokeWidth="1.4" />
          <ellipse cx="22" cy="29" rx="10.5" ry="7" fill="#F97316" stroke="#431407" strokeWidth="1.5" />
          <path d="M17 24 L18 32 M22 23 L23 33 M27 24 L27 32" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="20" r="6.8" fill="#FB923C" stroke="#431407" strokeWidth="1.5" />
          <ellipse cx="32.5" cy="22.5" rx="4" ry="2.5" fill="#FFF7ED" />
          <circle cx="27.5" cy="14.5" r="2.2" fill="#F97316" stroke="#431407" strokeWidth="1.3" />
          <circle cx="36.5" cy="14.5" r="2.2" fill="#F97316" stroke="#431407" strokeWidth="1.3" />
          <circle cx="30" cy="19" r="1.1" fill="#1C1917" />
          <circle cx="34.5" cy="19" r="1.1" fill="#1C1917" />
        </g>
      )}

      {speciesId === 'flamingo' && (
        <g>
          <path d="M22 30 L22 42 M26 30 L26 37 L22 37" stroke="#F472B6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <ellipse cx="23" cy="27" rx="8" ry="5.5" fill="#F472B6" stroke="#831843" strokeWidth="1.4" />
          <path d="M29 25 Q34 19 30 12 Q28 9 32 9" stroke="#F472B6" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <circle cx="32.5" cy="9.5" r="3.2" fill="#FB7185" stroke="#831843" strokeWidth="1.3" />
          <path d="M35 9.5 Q39 10 38 13.5 L34 11.5 Z" fill="#1E293B" />
          <circle cx="33" cy="9" r="0.9" fill="#0F172A" />
        </g>
      )}

      {speciesId === 'koala' && (
        <g>
          <rect x="29" y="14" width="5" height="27" rx="2" fill="#6B4423" />
          <ellipse cx="21" cy="30" rx="8" ry="9" fill="#94A3B8" stroke="#334155" strokeWidth="1.5" />
          <ellipse cx="22.5" cy="30" rx="4.5" ry="6" fill="#E2E8F0" />
          <circle cx="14.5" cy="16" r="4.5" fill="#CBD5E1" stroke="#334155" strokeWidth="1.4" />
          <circle cx="29.5" cy="16" r="4.5" fill="#CBD5E1" stroke="#334155" strokeWidth="1.4" />
          <circle cx="22" cy="19" r="7.5" fill="#94A3B8" stroke="#334155" strokeWidth="1.5" />
          <ellipse cx="22" cy="20.5" rx="2" ry="3.2" fill="#1E293B" />
          <circle cx="18.5" cy="18" r="1.1" fill="#0F172A" />
          <circle cx="25.5" cy="18" r="1.1" fill="#0F172A" />
        </g>
      )}

      {speciesId === 'hippo' && (
        <g>
          <rect x="14" y="33" width="4.5" height="7" rx="1.6" fill="#645870" stroke="#2E2636" strokeWidth="1.4" />
          <rect x="25" y="33" width="4.5" height="7" rx="1.6" fill="#645870" stroke="#2E2636" strokeWidth="1.4" />
          <ellipse cx="21.5" cy="28" rx="12" ry="8.5" fill="#7D6F8A" stroke="#2E2636" strokeWidth="1.5" />
          <circle cx="32" cy="22" r="6.5" fill="#7D6F8A" stroke="#2E2636" strokeWidth="1.5" />
          <ellipse cx="36.5" cy="24.5" rx="5.5" ry="4.2" fill="#9485A3" stroke="#2E2636" strokeWidth="1.4" />
          <circle cx="29" cy="16" r="1.8" fill="#7D6F8A" stroke="#2E2636" strokeWidth="1.2" />
          <circle cx="31.5" cy="19.5" r="1.1" fill="#0F172A" />
          <circle cx="38" cy="23.5" r="1" fill="#2E2636" />
        </g>
      )}

      {speciesId === 'cheetah' && (
        <g>
          <path d="M11 29 Q5 24 8 19" stroke="#D99B38" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <rect x="14" y="32" width="3.2" height="9" rx="1.4" fill="#EBB44A" stroke="#452B0F" strokeWidth="1.3" />
          <rect x="27" y="32" width="3.2" height="9" rx="1.4" fill="#EBB44A" stroke="#452B0F" strokeWidth="1.3" />
          <ellipse cx="22" cy="28.5" rx="10.5" ry="6.2" fill="#EBB44A" stroke="#452B0F" strokeWidth="1.4" />
          <circle cx="17" cy="27" r="1.2" fill="#1E1813" />
          <circle cx="21.5" cy="25.5" r="1.2" fill="#1E1813" />
          <circle cx="25.5" cy="29" r="1.2" fill="#1E1813" />
          <circle cx="19.5" cy="30.5" r="1.1" fill="#1E1813" />
          <circle cx="33" cy="19.5" r="5.8" fill="#F2C15A" stroke="#452B0F" strokeWidth="1.4" />
          <circle cx="29" cy="14" r="2" fill="#EBB44A" stroke="#452B0F" strokeWidth="1.2" />
          <circle cx="36.5" cy="14" r="2" fill="#EBB44A" stroke="#452B0F" strokeWidth="1.2" />
          <path d="M31.5 19.5 L31 23 M34.5 19.5 L35 23" stroke="#1E1813" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="31.5" cy="18.5" r="1.1" fill="#1E1813" />
          <circle cx="35" cy="18.5" r="1.1" fill="#1E1813" />
        </g>
      )}

      {speciesId === 'meerkat' && (
        <g>
          <path d="M19 36 L11 39" stroke="#9E7B54" strokeWidth="2.8" strokeLinecap="round" />
          <ellipse cx="24" cy="28" rx="6.2" ry="11.5" fill="#C9A87C" stroke="#4A3520" strokeWidth="1.4" />
          <ellipse cx="24.5" cy="29" rx="3.8" ry="8" fill="#EFE0C6" />
          <path d="M20 26 L28 26 M19.5 30 L28.5 30" stroke="#7A5A3A" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="24.5" cy="15" r="5.8" fill="#D5B68C" stroke="#4A3520" strokeWidth="1.4" />
          <ellipse cx="22" cy="14.5" rx="2" ry="1.6" fill="#3D2B1A" />
          <ellipse cx="27" cy="14.5" rx="2" ry="1.6" fill="#3D2B1A" />
          <circle cx="22.2" cy="14.5" r="0.8" fill="#FFFFFF" />
          <circle cx="26.8" cy="14.5" r="0.8" fill="#FFFFFF" />
          <circle cx="24.5" cy="17.2" r="1.2" fill="#2A1C10" />
        </g>
      )}

      {speciesId === 'kangaroo' && (
        <g>
          <path d="M16 34 Q8 38 6 33" stroke="#A64B2A" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="22" cy="30" rx="7.5" ry="9" transform="rotate(-12 22 30)" fill="#C6613A" stroke="#4F2110" strokeWidth="1.4" />
          <ellipse cx="24" cy="31.5" rx="4.2" ry="5.5" fill="#F2D7BF" />
          <rect x="20" y="38" width="9" height="3" rx="1.5" fill="#A64B2A" stroke="#4F2110" strokeWidth="1.2" />
          <ellipse cx="27" cy="17" rx="5.2" ry="4.2" fill="#C6613A" stroke="#4F2110" strokeWidth="1.4" />
          <ellipse cx="24.5" cy="10.5" rx="1.8" ry="4.5" transform="rotate(-14 24.5 10.5)" fill="#C6613A" stroke="#4F2110" strokeWidth="1.2" />
          <ellipse cx="28.5" cy="10.5" rx="1.8" ry="4.5" transform="rotate(14 28.5 10.5)" fill="#C6613A" stroke="#4F2110" strokeWidth="1.2" />
          <circle cx="29" cy="16" r="1.1" fill="#1C1917" />
        </g>
      )}

      {speciesId === 'peacock' && (
        <g>
          <path d="M12 28 Q22 8 34 26 Q24 34 12 28 Z" fill="#10B981" stroke="#064E3B" strokeWidth="1.3" />
          <circle cx="18" cy="21" r="2.2" fill="#1D4ED8" stroke="#FACC15" strokeWidth="0.9" />
          <circle cx="24" cy="16" r="2.2" fill="#1D4ED8" stroke="#FACC15" strokeWidth="0.9" />
          <circle cx="29" cy="21" r="2.2" fill="#1D4ED8" stroke="#FACC15" strokeWidth="0.9" />
          <ellipse cx="25" cy="31" rx="6.5" ry="5.5" fill="#0D9488" stroke="#064E3B" strokeWidth="1.3" />
          <path d="M28 29 Q32 22 31 15" stroke="#1D4ED8" strokeWidth="4.2" strokeLinecap="round" fill="none" />
          <circle cx="31.5" cy="14" r="3.6" fill="#1D4ED8" stroke="#0F172A" strokeWidth="1.2" />
          <path d="M30 10 L29 7 M32 9.8 L32 6.8" stroke="#FACC15" strokeWidth="1.3" strokeLinecap="round" />
          <polygon points="34.5,13.5 39,14.8 34.5,16" fill="#F59E0B" />
          <circle cx="32.5" cy="13.5" r="0.9" fill="#FFFFFF" />
        </g>
      )}

      {speciesId === 'polar_bear' && (
        <g>
          <rect x="13" y="32" width="5" height="9" rx="2" fill="#F1F5F9" stroke="#475569" strokeWidth="1.4" />
          <rect x="25" y="32" width="5" height="9" rx="2" fill="#F1F5F9" stroke="#475569" strokeWidth="1.4" />
          <ellipse cx="21" cy="27" rx="11.5" ry="8.5" fill="#F8FAFC" stroke="#475569" strokeWidth="1.5" />
          <circle cx="32.5" cy="19.5" r="7" fill="#FFFFFF" stroke="#475569" strokeWidth="1.5" />
          <ellipse cx="37.5" cy="21.5" rx="3.5" ry="2.6" fill="#F1F5F9" stroke="#475569" strokeWidth="1.2" />
          <circle cx="28.5" cy="14" r="2.2" fill="#FFFFFF" stroke="#475569" strokeWidth="1.3" />
          <circle cx="35.5" cy="14" r="2.2" fill="#FFFFFF" stroke="#475569" strokeWidth="1.3" />
          <circle cx="34" cy="18.5" r="1.1" fill="#0F172A" />
          <circle cx="39.5" cy="21" r="1.3" fill="#0F172A" />
        </g>
      )}

      {speciesId === 'otter' && (
        <g>
          <path d="M12 31 Q5 33 7 27" stroke="#5C4033" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <ellipse cx="22" cy="30" rx="11.5" ry="6.2" fill="#6F4E37" stroke="#2D1B12" strokeWidth="1.4" />
          <ellipse cx="25" cy="32" rx="6.5" ry="3.2" fill="#C8AD93" />
          <circle cx="33" cy="23.5" r="5.8" fill="#6F4E37" stroke="#2D1B12" strokeWidth="1.4" />
          <ellipse cx="34.5" cy="25.5" rx="3.5" ry="2.5" fill="#DEC8B4" />
          <circle cx="29.5" cy="19" r="1.6" fill="#5C4033" />
          <circle cx="36" cy="19" r="1.6" fill="#5C4033" />
          <circle cx="32.5" cy="22.5" r="1.1" fill="#1C1917" />
          <circle cx="36.2" cy="24.5" r="1.1" fill="#1C1917" />
        </g>
      )}
    </svg>
  );
};
