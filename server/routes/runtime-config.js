import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const ALLOWED_API_KEYS = [
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'HAILUO_API_KEY',
    'FAL_API_KEY',
    'ARK_API_KEY',
    'KLING_ACCESS_KEY',
    'KLING_SECRET_KEY'
];

const EFFECTIVE_SCOPE = ['generate-image', 'generate-video'];

function maskValue(value) {
    const raw = typeof value === 'string' ? value : '';
    if (!raw) return '';
    if (raw.length <= 8) {
        return `${raw.slice(0, 2)}****`;
    }
    return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}

function serializeEnvValue(value) {
    if (!value) return '';
    // Keep simple values unquoted for readability.
    if (/^[A-Za-z0-9_./:@-]+$/.test(value)) {
        return value;
    }
    return JSON.stringify(value);
}

function buildProviders(appLocals) {
    const providers = {};
    for (const key of ALLOWED_API_KEYS) {
        const value = typeof appLocals[key] === 'string' ? appLocals[key] : '';
        providers[key] = {
            isSet: !!value,
            maskedValue: maskValue(value)
        };
    }
    return providers;
}

function persistEnvFile(envPath, updates) {
    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf8');
    }

    const lines = content ? content.split(/\r?\n/) : [];
    const pendingKeys = new Set(Object.keys(updates));
    const updatedLines = lines.map((line) => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
        if (!match) return line;

        const key = match[1];
        if (!pendingKeys.has(key)) return line;

        pendingKeys.delete(key);
        return `${key}=${serializeEnvValue(updates[key])}`;
    });

    for (const key of pendingKeys) {
        updatedLines.push(`${key}=${serializeEnvValue(updates[key])}`);
    }

    const finalContent = `${updatedLines.join('\n').replace(/\n+$/g, '')}\n`;
    const tempPath = `${envPath}.tmp-${Date.now()}-${process.pid}`;

    fs.writeFileSync(tempPath, finalContent, 'utf8');
    fs.renameSync(tempPath, envPath);
}

router.get('/apikeys', (req, res) => {
    try {
        const providers = buildProviders(req.app.locals);
        res.json({
            providers,
            effectiveScope: EFFECTIVE_SCOPE
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to load API key config'
        });
    }
});

router.put('/apikeys', (req, res) => {
    const { updates } = req.body || {};

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid payload: updates object is required'
        });
    }

    const entries = Object.entries(updates);
    if (entries.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'No API key updates provided'
        });
    }

    const normalizedUpdates = {};
    for (const [key, value] of entries) {
        if (!ALLOWED_API_KEYS.includes(key)) {
            return res.status(400).json({
                success: false,
                error: `Unsupported key: ${key}`
            });
        }
        if (typeof value !== 'string') {
            return res.status(400).json({
                success: false,
                error: `Value for ${key} must be a string`
            });
        }
        normalizedUpdates[key] = value.trim();
    }

    const previousValues = {};
    for (const key of Object.keys(normalizedUpdates)) {
        previousValues[key] = typeof req.app.locals[key] === 'string' ? req.app.locals[key] : '';
        req.app.locals[key] = normalizedUpdates[key];
    }

    try {
        const envPath = req.app.locals.ENV_FILE_PATH || path.join(process.cwd(), '.env');
        persistEnvFile(envPath, normalizedUpdates);

        return res.json({
            success: true,
            updatedKeys: Object.keys(normalizedUpdates),
            effectiveScope: EFFECTIVE_SCOPE
        });
    } catch (error) {
        for (const [key, value] of Object.entries(previousValues)) {
            req.app.locals[key] = value;
        }

        return res.status(500).json({
            success: false,
            error: `Failed to persist .env: ${error.message || 'unknown error'}`
        });
    }
});

export default router;
