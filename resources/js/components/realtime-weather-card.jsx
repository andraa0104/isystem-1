import { MapPin, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ─── Weather Code Mapping (WMO Standard) ────────────────────────────────── */
const WEATHER_CONFIG = {
    0: { label: 'Cerah Terik', type: 'clear', theme: 'amber', desc: 'Matahari terik & langit bersih' },
    1: { label: 'Cerah Berawan', type: 'partly-cloudy', theme: 'sky', desc: 'Matahari sebagian berawan' },
    2: { label: 'Sebagian Berawan', type: 'partly-cloudy', theme: 'sky', desc: 'Matahari tertutup sebagian awan' },
    3: { label: 'Berawan Mendung', type: 'cloudy', theme: 'slate', desc: 'Langit tertutup awan tebal' },
    45: { label: 'Berkabut', type: 'fog', theme: 'zinc', desc: 'Jarak pandang berkabut' },
    48: { label: 'Kabut Tebal', type: 'fog', theme: 'zinc', desc: 'Kabut tebal dingin' },
    51: { label: 'Gerimis Halus', type: 'drizzle', theme: 'cyan', desc: 'Tetesan gerimis rintik-rintik' },
    53: { label: 'Gerimis Sedang', type: 'drizzle', theme: 'cyan', desc: 'Gerimis merata' },
    55: { label: 'Gerimis Lebat', type: 'drizzle', theme: 'blue', desc: 'Gerimis tebal berangin' },
    61: { label: 'Hujan Ringan', type: 'rain', theme: 'blue', desc: 'Curah hujan ringan' },
    63: { label: 'Hujan Sedang', type: 'rain', theme: 'blue', desc: 'Hujan rintik membasahi' },
    65: { label: 'Hujan Lebat', type: 'heavy-rain', theme: 'indigo', desc: 'Hujan deras lebat' },
    80: { label: 'Hujan Lokal', type: 'rain', theme: 'blue', desc: 'Hujan sesaat' },
    81: { label: 'Hujan Deras', type: 'heavy-rain', theme: 'indigo', desc: 'Hujan deras berangin' },
    82: { label: 'Hujan Sangat Deras', type: 'heavy-rain', theme: 'indigo', desc: 'Curah hujan ekstrem' },
    95: { label: 'Badai Petir', type: 'thunderstorm', theme: 'purple', desc: 'Petir kilat menyambar & hujan' },
    96: { label: 'Badai & Hujan Es', type: 'thunderstorm', theme: 'purple', desc: 'Petir guruh & hujan es' },
    99: { label: 'Badai Petir Hebat', type: 'thunderstorm', theme: 'purple', desc: 'Badai petir lebat ekstrem' },
};

function getWeatherMeta(code, isDay = 1) {
    const fallback = { label: 'Cerah Berawan', type: 'partly-cloudy', theme: 'sky', desc: 'Kondisi bersahabat' };
    const conf = WEATHER_CONFIG[code] || fallback;
    const isNight = isDay === 0;

    let label = conf.label;
    if (isNight && conf.type === 'clear') {
        label = 'Malam Cerah';
    } else if (isNight && conf.type === 'partly-cloudy') {
        label = 'Malam Berawan';
    }

    return {
        ...conf,
        isNight,
        label,
    };
}

/* ─── 3D Animated Weather Visual (CSS3 3D & Layered Lighting) ────────────── */
function AnimatedWeather3D({ type = 'clear', isNight = false, size = 68 }) {
    const isSun = type === 'clear' && !isNight;
    const isMoon = type === 'clear' && isNight;
    const isPartly = type === 'partly-cloudy';
    const isCloudy = type === 'cloudy';
    const isFog = type === 'fog';
    const isDrizzle = type === 'drizzle';
    const isRain = type === 'rain';
    const isHeavyRain = type === 'heavy-rain';
    const isThunder = type === 'thunderstorm';

    return (
        <div
            className="relative flex items-center justify-center shrink-0 select-none pointer-events-none"
            style={{ width: size, height: size }}
        >
            <style>{`
                /* ── Sun Terik Animations ── */
                @keyframes sunRaySpinClockwise {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes sunRaySpinCounter {
                    from { transform: rotate(360deg); }
                    to { transform: rotate(0deg); }
                }
                @keyframes sunHeatPulse {
                    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.55)); }
                    50% { transform: scale(1.06); filter: drop-shadow(0 0 24px rgba(245, 158, 11, 0.95)) brightness(1.12); }
                }
                @keyframes sunFlareWave {
                    0%, 100% { opacity: 0.45; transform: scale(0.92); }
                    50% { opacity: 0.85; transform: scale(1.15); }
                }

                /* ── Partly Cloudy (Matahari sedikit tertutup awan) ── */
                @keyframes partlySunSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes partlyCloudDrift {
                    0%, 100% { transform: translate(0px, 0px) scale(1); }
                    50% { transform: translate(-4px, -2px) scale(1.02); }
                }

                /* ── Overcast / Cloudy Drift ── */
                @keyframes cloudBackDrift {
                    0%, 100% { transform: translateX(0px); }
                    50% { transform: translateX(5px); }
                }
                @keyframes cloudFrontDrift {
                    0%, 100% { transform: translateX(0px); }
                    50% { transform: translateX(-4px); }
                }

                /* ── Fog Waves ── */
                @keyframes fogWave1 {
                    0%, 100% { transform: translateX(-6px); opacity: 0.6; }
                    50% { transform: translateX(6px); opacity: 0.95; }
                }
                @keyframes fogWave2 {
                    0%, 100% { transform: translateX(7px); opacity: 0.8; }
                    50% { transform: translateX(-5px); opacity: 0.5; }
                }

                /* ── Rain & Drizzle Drops ── */
                @keyframes drizzleDrop {
                    0% { transform: translateY(-6px); opacity: 0; }
                    40% { opacity: 0.75; }
                    100% { transform: translateY(14px); opacity: 0; }
                }
                @keyframes rainDropFall {
                    0% { transform: translateY(-10px) scaleY(0.7); opacity: 0; }
                    35% { opacity: 1; }
                    100% { transform: translateY(20px) scaleY(1.3); opacity: 0; }
                }
                @keyframes heavyRainDropFall {
                    0% { transform: translate(4px, -12px) rotate(14deg) scaleY(0.8); opacity: 0; }
                    30% { opacity: 1; }
                    100% { transform: translate(-8px, 24px) rotate(14deg) scaleY(1.4); opacity: 0; }
                }

                /* ── Lightning Flash ── */
                @keyframes lightning3dStrike {
                    0%, 100% { opacity: 0; filter: drop-shadow(0 0 0px transparent); }
                    7% { opacity: 0.1; }
                    9% { opacity: 1; filter: drop-shadow(0 0 16px #facc15) brightness(1.8); }
                    12% { opacity: 0.2; }
                    15% { opacity: 1; filter: drop-shadow(0 0 22px #fef08a) brightness(2); }
                    20% { opacity: 0; }
                }
                @keyframes stormCloudPulse {
                    0%, 100% { filter: drop-shadow(0 8px 12px rgba(15, 23, 42, 0.45)); }
                    9%, 15% { filter: drop-shadow(0 8px 20px rgba(250, 204, 21, 0.65)) brightness(1.25); }
                }

                /* ── Night Stars Twinkle ── */
                @keyframes starTwinkle {
                    0%, 100% { opacity: 0.25; transform: scale(0.75); }
                    50% { opacity: 1; transform: scale(1.25); }
                }
                @keyframes moonFloating {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-3px) rotate(3deg); }
                }
            `}</style>

            <svg
                width={size}
                height={size}
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="overflow-visible"
            >
                <defs>
                    {/* 3D Sun Hot Core Gradients */}
                    <radialGradient id="sunHotCoreGrad" cx="35%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="20%" stopColor="#fef08a" />
                        <stop offset="55%" stopColor="#f59e0b" />
                        <stop offset="85%" stopColor="#ea580c" />
                        <stop offset="100%" stopColor="#c2410c" />
                    </radialGradient>
                    <radialGradient id="sunHotCoronaGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#f97316" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                    </radialGradient>

                    {/* 3D Moon Gradients */}
                    <radialGradient id="moonGrad3D" cx="38%" cy="30%" r="62%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="35%" stopColor="#e0e7ff" />
                        <stop offset="70%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#4338ca" />
                    </radialGradient>

                    {/* 3D Puffy Cloud Front Gradients */}
                    <linearGradient id="cloudFront3D" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="45%" stopColor="#f8fafc" />
                        <stop offset="80%" stopColor="#e2e8f0" />
                        <stop offset="100%" stopColor="#cbd5e1" />
                    </linearGradient>

                    {/* 3D Back Cloud (Depth Occlusion) */}
                    <linearGradient id="cloudBack3D" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#cbd5e1" />
                        <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>

                    {/* 3D Dark Storm Cloud */}
                    <linearGradient id="cloudStorm3D" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#94a3b8" />
                        <stop offset="40%" stopColor="#475569" />
                        <stop offset="80%" stopColor="#1e293b" />
                        <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>

                    {/* 3D Rain Droplet Gradient */}
                    <linearGradient id="rainDrop3DGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#a5f3fc" />
                        <stop offset="40%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>

                    {/* 3D Lightning Electric Gradient */}
                    <linearGradient id="lightningGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="30%" stopColor="#fef08a" />
                        <stop offset="70%" stopColor="#facc15" />
                        <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                </defs>

                {/* ══════════════════════════════════════════════════════════════
                    1. PANAS CERAH TERIK (INTENSE RADIANT 3D SUN)
                   ══════════════════════════════════════════════════════════════ */}
                {isSun && (
                    <g>
                        {/* Outer Pulsing Corona Heatwave */}
                        <circle
                            cx="50"
                            cy="50"
                            r="44"
                            fill="url(#sunHotCoronaGrad)"
                            style={{ animation: 'sunFlareWave 3s ease-in-out infinite' }}
                        />

                        {/* Outer Sun Rays (Counter-clockwise) */}
                        <g style={{ transformOrigin: '50px 50px', animation: 'sunRaySpinCounter 36s linear infinite' }}>
                            {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
                                <polygon
                                    key={`ray-out-${deg}`}
                                    points="50,6 52.5,15 47.5,15"
                                    fill="#f97316"
                                    opacity="0.75"
                                    transform={`rotate(${deg} 50 50)`}
                                />
                            ))}
                        </g>

                        {/* Primary Bold Sun Rays (Clockwise) */}
                        <g style={{ transformOrigin: '50px 50px', animation: 'sunRaySpinClockwise 22s linear infinite' }}>
                            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                                <polygon
                                    key={`ray-in-${deg}`}
                                    points="50,4 53.5,16 46.5,16"
                                    fill="#f59e0b"
                                    opacity="0.95"
                                    transform={`rotate(${deg} 50 50)`}
                                />
                            ))}
                        </g>

                        {/* Pulsing 3D Volumetric Sun Sphere */}
                        <g style={{ transformOrigin: '50px 50px', animation: 'sunHeatPulse 2.8s ease-in-out infinite' }}>
                            <circle
                                cx="50"
                                cy="50"
                                r="23"
                                fill="url(#sunHotCoreGrad)"
                                style={{ filter: 'drop-shadow(0 6px 14px rgba(234, 88, 12, 0.6))' }}
                            />
                            {/* Hot Glint Specular Shimmer */}
                            <ellipse cx="43" cy="43" rx="7" ry="4" fill="#ffffff" opacity="0.8" transform="rotate(-30 43 43)" />
                            <circle cx="48" cy="40" r="2" fill="#ffffff" opacity="0.9" />
                        </g>
                    </g>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    2. CERAH BERAWAN (MATAHARI SEDIKIT TERTUTUP AWAN MELAYANG)
                   ══════════════════════════════════════════════════════════════ */}
                {isPartly && (
                    <g>
                        {/* Background Sun (Positioned Top-Right, Peeking Out) */}
                        <g style={{ transformOrigin: '60px 38px', animation: 'partlySunSpin 28s linear infinite' }}>
                            <circle cx="60" cy="38" r="26" fill="url(#sunHotCoronaGrad)" opacity="0.65" />
                            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                                <polygon
                                    key={deg}
                                    points="60,18 62.5,25 57.5,25"
                                    fill="#f59e0b"
                                    opacity="0.9"
                                    transform={`rotate(${deg} 60 38)`}
                                />
                            ))}
                            <circle cx="60" cy="38" r="16" fill="url(#sunHotCoreGrad)" />
                            <ellipse cx="56" cy="33" rx="4.5" ry="2.5" fill="#ffffff" opacity="0.75" transform="rotate(-30 56 33)" />
                        </g>

                        {/* Foreground 3D Puffy Cloud Floating Over & Partially Covering the Sun */}
                        <g style={{ animation: 'partlyCloudDrift 4s ease-in-out infinite' }}>
                            {/* Ambient Cloud Under-Shadow onto Sun */}
                            <path
                                d="M22 72 H68 C75 72 80 66.5 80 60 C80 54 75.5 49 69.5 48.2 C68 40.5 61.2 34.5 53 34.5 C46.2 34.5 40.3 38.8 38 45 C35.8 44 33.2 43.5 30.5 43.5 C22.5 43.5 16 50 16 58 C16 65.5 22 72 22 72 Z"
                                fill="url(#cloudFront3D)"
                                style={{ filter: 'drop-shadow(0 10px 14px rgba(15, 23, 42, 0.22))' }}
                            />
                            {/* Cloud White Gloss Ridge */}
                            <ellipse cx="52" cy="40" rx="10" ry="4" fill="#ffffff" opacity="0.9" />
                            <ellipse cx="32" cy="49" rx="6" ry="2.5" fill="#ffffff" opacity="0.75" />
                        </g>
                    </g>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    3. BERAWAN TEBAL / MENDUNG (OVERCAST CLOUDS DRIFTING)
                   ══════════════════════════════════════════════════════════════ */}
                {isCloudy && (
                    <g>
                        {/* Back Darker Cloud Drifting Right */}
                        <g style={{ animation: 'cloudBackDrift 5s ease-in-out infinite' }}>
                            <path
                                d="M38 58 H76 C81.5 58 86 53.5 86 48 C86 43 82 39 77 38.2 C76 32 70.5 27 64 27 C58.2 27 53.3 30.6 51.5 35.8 C49.6 34.8 47.4 34.2 45 34.2 C38 34.2 32.5 39.5 32.5 46.5 C32.5 53 37.5 58 38 58 Z"
                                fill="url(#cloudBack3D)"
                                opacity="0.9"
                            />
                        </g>

                        {/* Front Puffy Cloud Drifting Left */}
                        <g style={{ animation: 'cloudFrontDrift 4.5s ease-in-out infinite' }}>
                            <path
                                d="M22 74 H68 C75 74 80 68.5 80 62 C80 56 75.5 51 69.5 50.2 C68 42.5 61.2 36.5 53 36.5 C46.2 36.5 40.3 40.8 38 47 C35.8 46 33.2 45.5 30.5 45.5 C22.5 45.5 16 52 16 60 C16 67.5 22 74 22 74 Z"
                                fill="url(#cloudFront3D)"
                                style={{ filter: 'drop-shadow(0 8px 14px rgba(30, 41, 59, 0.28))' }}
                            />
                            <ellipse cx="52" cy="42" rx="10" ry="3.5" fill="#ffffff" opacity="0.85" />
                        </g>
                    </g>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    4. BERKABUT (FOG / MIST WAVE STRATA)
                   ══════════════════════════════════════════════════════════════ */}
                {isFog && (
                    <g>
                        {/* Upper Soft Cloud Silhouette */}
                        <path
                            d="M28 46 H68 C74 46 78 42 78 37 C78 32.5 74.5 29 70 28.2 C69 23 64 19 58 19 C52.5 19 48 22 46.5 26.5 C45 25.5 43 25 41 25 C35 25 30 29.5 30 35.5 C30 41.5 34.5 46 38 46 Z"
                            fill="url(#cloudBack3D)"
                            opacity="0.45"
                        />

                        {/* 3D Mist Wave Bars */}
                        <g style={{ animation: 'fogWave1 4s ease-in-out infinite' }}>
                            <rect x="18" y="52" width="56" height="5.5" rx="2.75" fill="#e2e8f0" opacity="0.9" />
                            <rect x="26" y="62" width="48" height="5" rx="2.5" fill="#cbd5e1" opacity="0.8" />
                        </g>
                        <g style={{ animation: 'fogWave2 3.6s ease-in-out infinite' }}>
                            <rect x="22" y="44" width="44" height="4.5" rx="2.25" fill="#f1f5f9" opacity="0.85" />
                            <rect x="16" y="71" width="62" height="5.5" rx="2.75" fill="#94a3b8" opacity="0.75" />
                        </g>
                    </g>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    5. GERIMIS HALUS (DRIZZLE: GENTLE LIGHT RAIN)
                   ══════════════════════════════════════════════════════════════ */}
                {isDrizzle && (
                    <g>
                        {/* Gentle Cloud */}
                        <g style={{ animation: 'partlyCloudDrift 4s ease-in-out infinite' }}>
                            <path
                                d="M22 62 H68 C75 62 80 56.5 80 50 C80 44 75.5 39 69.5 38.2 C68 30.5 61.2 24.5 53 24.5 C46.2 24.5 40.3 28.8 38 35 C35.8 34 33.2 33.5 30.5 33.5 C22.5 33.5 16 40 16 48 C16 55.5 22 62 22 62 Z"
                                fill="url(#cloudFront3D)"
                                style={{ filter: 'drop-shadow(0 6px 12px rgba(15, 23, 42, 0.2))' }}
                            />
                            <ellipse cx="52" cy="30" rx="9" ry="3" fill="#ffffff" opacity="0.85" />
                        </g>

                        {/* Light Drizzle Beads */}
                        <g>
                            <circle cx="32" cy="70" r="1.8" fill="url(#rainDrop3DGrad)" style={{ animation: 'drizzleDrop 1.2s infinite' }} />
                            <circle cx="44" cy="72" r="1.8" fill="url(#rainDrop3DGrad)" style={{ animation: 'drizzleDrop 1.1s infinite 0.35s' }} />
                            <circle cx="56" cy="71" r="1.8" fill="url(#rainDrop3DGrad)" style={{ animation: 'drizzleDrop 1.3s infinite 0.7s' }} />
                            <circle cx="68" cy="70" r="1.8" fill="url(#rainDrop3DGrad)" style={{ animation: 'drizzleDrop 1.05s infinite 0.2s' }} />
                        </g>
                    </g>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    6. HUJAN SEDANG / RINGAN (MODERATE RAIN WITH DROPS)
                   ══════════════════════════════════════════════════════════════ */}
                {isRain && (
                    <g>
                        {/* Rain Cloud */}
                        <g style={{ animation: 'partlyCloudDrift 3.6s ease-in-out infinite' }}>
                            <path
                                d="M22 62 H68 C75 62 80 56.5 80 50 C80 44 75.5 39 69.5 38.2 C68 30.5 61.2 24.5 53 24.5 C46.2 24.5 40.3 28.8 38 35 C35.8 34 33.2 33.5 30.5 33.5 C22.5 33.5 16 40 16 48 C16 55.5 22 62 22 62 Z"
                                fill="url(#cloudFront3D)"
                                style={{ filter: 'drop-shadow(0 6px 12px rgba(15, 23, 42, 0.25))' }}
                            />
                        </g>

                        {/* Animated Falling Glass Rain Droplets */}
                        <g>
                            <line x1="30" y1="67" x2="27" y2="79" stroke="url(#rainDrop3DGrad)" strokeWidth="3" strokeLinecap="round" style={{ animation: 'rainDropFall 0.95s linear infinite' }} />
                            <line x1="44" y1="68" x2="41" y2="81" stroke="url(#rainDrop3DGrad)" strokeWidth="3.2" strokeLinecap="round" style={{ animation: 'rainDropFall 1.05s linear infinite 0.3s' }} />
                            <line x1="58" y1="67" x2="55" y2="80" stroke="url(#rainDrop3DGrad)" strokeWidth="3" strokeLinecap="round" style={{ animation: 'rainDropFall 0.9s linear infinite 0.6s' }} />
                            <line x1="70" y1="68" x2="67" y2="79" stroke="url(#rainDrop3DGrad)" strokeWidth="2.8" strokeLinecap="round" style={{ animation: 'rainDropFall 1.1s linear infinite 0.15s' }} />
                        </g>
                    </g>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    7. HUJAN LEBAT / DERAS (HEAVY DOWNPOUR WITH SLANTED RAIN)
                   ══════════════════════════════════════════════════════════════ */}
                {isHeavyRain && (
                    <g>
                        {/* Dark Heavy Storm Cloud */}
                        <g style={{ animation: 'partlyCloudDrift 3.2s ease-in-out infinite' }}>
                            <path
                                d="M22 60 H68 C75 60 80 54.5 80 48 C80 42 75.5 37 69.5 36.2 C68 28.5 61.2 22.5 53 22.5 C46.2 22.5 40.3 26.8 38 33 C35.8 32 33.2 31.5 30.5 31.5 C22.5 31.5 16 38 16 46 C16 53.5 22 60 22 60 Z"
                                fill="url(#cloudStorm3D)"
                                style={{ filter: 'drop-shadow(0 8px 14px rgba(15, 23, 42, 0.45))' }}
                            />
                        </g>

                        {/* Dense Slanted Downpour Rain Streaks */}
                        <g>
                            <line x1="30" y1="65" x2="23" y2="82" stroke="url(#rainDrop3DGrad)" strokeWidth="3.2" strokeLinecap="round" style={{ animation: 'heavyRainDropFall 0.75s linear infinite' }} />
                            <line x1="42" y1="64" x2="35" y2="83" stroke="url(#rainDrop3DGrad)" strokeWidth="3.5" strokeLinecap="round" style={{ animation: 'heavyRainDropFall 0.7s linear infinite 0.15s' }} />
                            <line x1="54" y1="66" x2="47" y2="84" stroke="url(#rainDrop3DGrad)" strokeWidth="3.2" strokeLinecap="round" style={{ animation: 'heavyRainDropFall 0.8s linear infinite 0.35s' }} />
                            <line x1="66" y1="65" x2="59" y2="82" stroke="url(#rainDrop3DGrad)" strokeWidth="3.4" strokeLinecap="round" style={{ animation: 'heavyRainDropFall 0.72s linear infinite 0.5s' }} />
                        </g>
                    </g>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    8. BADAI PETIR (THUNDERSTORM WITH ELECTRIC LIGHTNING FLASH)
                   ══════════════════════════════════════════════════════════════ */}
                {isThunder && (
                    <g>
                        {/* Deep Dark Storm Cloud (Pulsing Ambient Flash) */}
                        <g style={{ animation: 'stormCloudPulse 2.4s infinite' }}>
                            <path
                                d="M22 56 H68 C75 56 80 50.5 80 44 C80 38 75.5 33 69.5 32.2 C68 24.5 61.2 18.5 53 18.5 C46.2 18.5 40.3 22.8 38 29 C35.8 28 33.2 27.5 30.5 27.5 C22.5 27.5 16 34 16 42 C16 49.5 22 56 22 56 Z"
                                fill="url(#cloudStorm3D)"
                            />
                        </g>

                        {/* Sharp 3D Neon Gold Lightning Bolt */}
                        <polygon
                            points="52,48 40,68 49,68 43,90 64,62 53,62"
                            fill="url(#lightningGrad)"
                            stroke="#eab308"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                            style={{ animation: 'lightning3dStrike 2.4s infinite' }}
                        />

                        {/* Rain Drops */}
                        <g>
                            <line x1="28" y1="63" x2="24" y2="77" stroke="url(#rainDrop3DGrad)" strokeWidth="2.6" strokeLinecap="round" style={{ animation: 'rainDropFall 0.85s linear infinite 0.1s' }} />
                            <line x1="68" y1="63" x2="64" y2="77" stroke="url(#rainDrop3DGrad)" strokeWidth="2.6" strokeLinecap="round" style={{ animation: 'rainDropFall 0.9s linear infinite 0.4s' }} />
                        </g>
                    </g>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    9. MALAM CERAH (GLOWING CRESCENT MOON & TWINKLING STARS)
                   ══════════════════════════════════════════════════════════════ */}
                {isMoon && (
                    <g style={{ animation: 'moonFloating 4.5s ease-in-out infinite' }}>
                        {/* Twinkling Diamond Star Particles */}
                        <path d="M74 24 L76 29 L81 31 L76 33 L74 38 L72 33 L67 31 L72 29 Z" fill="#fef08a" style={{ animation: 'starTwinkle 2.4s ease-in-out infinite' }} />
                        <path d="M26 32 L27.5 35 L30.5 36.5 L27.5 38 L26 41 L24.5 38 L21.5 36.5 L24.5 35 Z" fill="#93c5fd" style={{ animation: 'starTwinkle 3s ease-in-out infinite 0.9s' }} />
                        <circle cx="78" cy="62" r="1.5" fill="#e0e7ff" style={{ animation: 'starTwinkle 2s ease-in-out infinite 0.5s' }} />

                        {/* 3D Volumetric Crescent Moon */}
                        <path
                            d="M 52 22 A 25 25 0 1 0 70 66 A 20 20 0 1 1 52 22 Z"
                            fill="url(#moonGrad3D)"
                            style={{ filter: 'drop-shadow(0 6px 16px rgba(99, 102, 241, 0.55))' }}
                        />
                        {/* Subtle Moon Crater Accents */}
                        <circle cx="42" cy="48" r="3.2" fill="#4338ca" opacity="0.3" />
                        <circle cx="48" cy="60" r="2.2" fill="#4338ca" opacity="0.25" />
                        <circle cx="36" cy="38" r="2" fill="#4338ca" opacity="0.2" />
                    </g>
                )}
            </svg>
        </div>
    );
}

/* ─── Main Realtime Weather Card Component ───────────────────────────────── */
export default function RealtimeWeatherCard({ className = '' }) {
    const [weather, setWeather] = useState(null);
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tiltStyle, setTiltStyle] = useState({});
    const cardRef = useRef(null);

    // Fetch IP Location & Open-Meteo Weather
    const loadWeather = useCallback(async (isManual = false) => {
        if (isManual) setRefreshing(true);

        const CACHE_KEY = 'isystem_realtime_weather_v3';
        const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

        // Check sessionStorage cache unless manual refresh
        if (!isManual) {
            try {
                const cachedRaw = window.sessionStorage.getItem(CACHE_KEY);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
                        setWeather(cached.weather);
                        setLocation(cached.location);
                        setLoading(false);
                        return;
                    }
                }
            } catch {
                // Cache parse error ignored
            }
        }

        try {
            // 1. Dapatkan lokasi internet user via IP Geolocation (CORS HTTPS, tanpa API key)
            let locData = {
                city: 'Samarinda',
                region: 'Kaltim',
                country: 'ID',
                lat: -0.5007,
                lon: 117.1787,
            };

            try {
                const geoController = new AbortController();
                const geoTimeout = setTimeout(() => geoController.abort(), 3500);
                const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json', {
                    signal: geoController.signal,
                });
                clearTimeout(geoTimeout);

                if (geoRes.ok) {
                    const geo = await geoRes.json();
                    if (geo && geo.latitude && geo.longitude) {
                        locData = {
                            city: geo.city || 'Kota Pengguna',
                            region: geo.region || '',
                            country: geo.country_code || 'ID',
                            lat: Number(geo.latitude),
                            lon: Number(geo.longitude),
                        };
                    }
                }
            } catch {
                // Fallback secondary geo API
                try {
                    const fallbackRes = await fetch('https://ipapi.co/json/');
                    if (fallbackRes.ok) {
                        const fallbackGeo = await fallbackRes.json();
                        if (fallbackGeo.latitude && fallbackGeo.longitude) {
                            locData = {
                                city: fallbackGeo.city || locData.city,
                                region: fallbackGeo.region || locData.region,
                                country: fallbackGeo.country_code || locData.country,
                                lat: Number(fallbackGeo.latitude),
                                lon: Number(fallbackGeo.longitude),
                            };
                        }
                    }
                } catch {
                    // Fallback default
                }
            }

            // 2. Tarik data cuaca terkini dari Open-Meteo (Realtime, Free, CORS HTTPS)
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${locData.lat}&longitude=${locData.lon}&current=temperature_2m,is_day,weather_code&timezone=auto`;
            const weatherRes = await fetch(weatherUrl);

            if (!weatherRes.ok) {
                throw new Error('Gagal memuat cuaca');
            }

            const weatherJson = await weatherRes.json();
            const current = weatherJson.current || {};

            const weatherPayload = {
                temperature: Math.round(Number(current.temperature_2m ?? 29)),
                isDay: Number(current.is_day ?? 1),
                weatherCode: Number(current.weather_code ?? 1),
                updatedAt: new Date().toISOString(),
            };

            setWeather(weatherPayload);
            setLocation(locData);

            // Simpan ke cache
            window.sessionStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    weather: weatherPayload,
                    location: locData,
                    timestamp: Date.now(),
                }),
            );
        } catch {
            // Fallback default yang masuk akal
            setWeather((prev) =>
                prev || {
                    temperature: 29,
                    isDay: 1,
                    weatherCode: 1,
                    updatedAt: new Date().toISOString(),
                },
            );
            setLocation((prev) =>
                prev || {
                    city: 'Samarinda',
                    region: 'Kaltim',
                    country: 'ID',
                    lat: -0.5007,
                    lon: 117.1787,
                },
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadWeather();

        // Auto refresh tiap 15 menit
        const interval = setInterval(() => {
            loadWeather(false);
        }, 15 * 60 * 1000);

        return () => clearInterval(interval);
    }, [loadWeather]);

    // Interactive 3D Card Tilt Effect on Mouse Move
    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const tiltX = (0.5 - y) * 14;
        const tiltY = (x - 0.5) * 16;

        setTiltStyle({
            transform: `perspective(700px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translateZ(6px)`,
        });
    };

    const handleMouseLeave = () => {
        setTiltStyle({
            transform: 'perspective(700px) rotateX(0deg) rotateY(0deg) translateZ(0px)',
        });
    };

    const meta = useMemo(
        () => getWeatherMeta(weather?.weatherCode ?? 1, weather?.isDay ?? 1),
        [weather?.weatherCode, weather?.isDay],
    );

    // Dynamic Ambient Glow Color by Weather Theme
    const glowColor = useMemo(() => {
        if (meta.theme === 'amber') return 'bg-amber-500/15 dark:bg-amber-500/25';
        if (meta.theme === 'purple') return 'bg-purple-500/15 dark:bg-purple-500/25';
        if (meta.theme === 'blue' || meta.theme === 'indigo') return 'bg-blue-500/15 dark:bg-blue-500/25';
        if (meta.theme === 'cyan') return 'bg-cyan-500/15 dark:bg-cyan-500/25';
        return 'bg-emerald-500/10 dark:bg-emerald-500/20';
    }, [meta.theme]);

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                transition: 'transform 0.22s ease-out, box-shadow 0.22s ease-out',
                ...tiltStyle,
            }}
            className={`group relative overflow-hidden rounded-2xl border border-border/80 bg-card/85 p-3 sm:p-3.5 backdrop-blur-xl shadow-lg shadow-black/[0.04] dark:shadow-black/25 transition-all duration-300 hover:border-border hover:shadow-xl ${className}`}
        >
            {/* 3D Glossy Light Reflection Bar */}
            <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
            <div className={`pointer-events-none absolute -right-10 -bottom-10 size-36 rounded-full ${glowColor} blur-2xl transition-colors duration-500`} />

            <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
                {/* 3D Animated Weather Visual Icon */}
                <div className="flex items-center gap-3">
                    <AnimatedWeather3D
                        type={meta.type}
                        isNight={meta.isNight}
                        size={58}
                    />

                    {/* Temperature, Condition Label & Description */}
                    <div className="space-y-0.5">
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-mono text-2xl sm:text-3xl font-black tracking-tight text-foreground drop-shadow-xs">
                                {loading ? '--' : weather?.temperature}°
                                <span className="text-sm sm:text-base font-semibold text-muted-foreground">
                                    C
                                </span>
                            </span>
                            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                {meta.label}
                            </span>
                        </div>

                        {/* Location Indicator */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                            <MapPin className="size-3 text-emerald-500 shrink-0" />
                            <span className="truncate max-w-[150px] sm:max-w-[180px]">
                                {location?.city || 'Samarinda'}
                                {location?.country ? `, ${location.country}` : ''}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Manual Mini Refresh Button */}
                <button
                    type="button"
                    onClick={() => loadWeather(true)}
                    disabled={refreshing}
                    title="Segarkan data cuaca lokasi"
                    className="flex size-7 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                    <RefreshCw className={`size-3 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
                </button>
            </div>
        </div>
    );
}
