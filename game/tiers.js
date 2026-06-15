export const TIER_CONFIG = {
    MAX_LEVEL: 50,
    COLORS: [
        '#ffffff', 
        '#ffffff', // 1
        '#00ffd2', // 2
        '#00d2ff', // 3
        '#ff00d2', // 4
        '#ffdd00', // 5
        '#ffffff', // 6
        '#ff0000', // 7
        '#7000ff', // 8
        '#00ff22', // 9
        '#ffffff', // 10 (Prismatic)
        '#00eaff', '#00eaff', '#00eaff', '#00eaff', // 11-14 (Resonance)
        '#000000', // 15 (Singularity)
        '#ff003c', '#ff003c', '#ff003c', '#ff003c', // 16-19 (Event Horizon)
        '#ffffff', // 20 (Zero Point)
        '#ffae00', '#ffae00', '#ffae00', '#ffae00', '#ffae00', '#ffae00', '#ffae00', '#ffae00', '#ffae00', // 21-29 (Godhood)
        '#ffffff', // 30 (Genesis)
        '#00ff88', '#00ff88', '#00ff88', '#00ff88', '#00ff88', // 31-35 (Astral Flow)
        '#ff00ff', '#ff00ff', '#ff00ff', '#ff00ff', // 36-39 (Nebula Core)
        '#ffffff', // 40 (Cosmic Heart)
        '#55ff00', '#55ff00', '#55ff00', '#55ff00', // 41-44 (Aether)
        '#ff5500', '#ff5500', '#ff5500', '#ff5500', // 45-48 (Grand Design)
        '#0000ff', // 49 (Omega)
        '#ffffff'  // 50 (Aeternum)
    ],
    getName: (level) => {
        if (level <= 10) return '★'.repeat(level);
        if (level <= 14) return `RESONANCE ${(level - 10) * 100}%`;
        if (level === 15) return 'SINGULARITY';
        if (level <= 19) return `EVENT HORIZON ${level - 15}`;
        if (level === 20) return 'ZERO POINT';
        if (level <= 29) return `GODHOOD Tier ${level - 20}`;
        if (level === 30) return 'GENESIS';
        if (level <= 35) return `ASTRAL FLOW ${level - 30}`;
        if (level <= 39) return `NEBULA CORE ${level - 35}`;
        if (level === 40) return 'COSMIC HEART';
        if (level <= 44) return `AETHER BIND ${level - 40}`;
        if (level <= 48) return `GRAND DESIGN ${level - 44}`;
        if (level === 49) return 'OMEGA RIFT';
        if (level === 50) return 'AETERNUM';
        return 'UNKNOWN';
    },
    getLabel: (level) => {
        if (level >= 50) return 'THE ETERNAL ONE';
        if (level >= 49) return 'END OF EXISTENCE';
        if (level >= 45) return 'ARCHITECT OF REALITY';
        if (level >= 40) return 'HEART OF THE UNIVERSE';
        if (level >= 31) return 'CELESTIAL TRANSCENDENCE';
        if (level >= 30) return 'THE CREATOR';
        if (level >= 21) return 'DIVINE ASCENSION';
        if (level >= 20) return 'THE END';
        if (level >= 16) return 'LIMIT BREAK';
        if (level >= 15) return 'VOID MASTER';
        if (level >= 11) return 'GODLIKE CHARGE';
        return 'POWERING UP';
    },
    getPower: (level) => {
        return Math.pow(level, 4.5); // Insane scaling for 50 tiers
    }
};
