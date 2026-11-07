export default function AppLogoIcon({ className = 'size-8', ...props }) {
    return (
        <div
            className={`relative flex items-center justify-center ${className}`}
            {...props}
        >
            <svg
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="size-full drop-shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
            >
                <defs>
                    <linearGradient
                        id="isystem-shield-grad"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                    >
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <linearGradient
                        id="isystem-inner-glow"
                        x1="50%"
                        y1="0%"
                        x2="50%"
                        y2="100%"
                    >
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
                    </linearGradient>
                </defs>

                {/* Outer Cyber Hexagon / Shield */}
                <polygon
                    points="20,3 36,11.5 36,28.5 20,37 4,28.5 4,11.5"
                    stroke="url(#isystem-shield-grad)"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    fill="url(#isystem-inner-glow)"
                />

                {/* Cyber Geometric Node Grid */}
                <path
                    d="M20 3 L20 20 L36 28.5 M20 20 L4 28.5 M20 20 L20 37"
                    stroke="url(#isystem-shield-grad)"
                    strokeWidth="1.2"
                    strokeOpacity="0.45"
                    strokeDasharray="2.5 2.5"
                />

                {/* Central Quantum Core Node */}
                <circle cx="20" cy="20" r="5" fill="url(#isystem-shield-grad)" />
                <circle cx="20" cy="20" r="2.2" fill="#ffffff" />

                {/* Satellite Orbital Nodes */}
                <circle cx="20" cy="7" r="1.6" fill="#34d399" />
                <circle cx="31.5" cy="14" r="1.6" fill="#38bdf8" />
                <circle cx="8.5" cy="26" r="1.6" fill="#818cf8" />
            </svg>
        </div>
    );
}
