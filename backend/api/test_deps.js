module.exports = (req, res) => {
    const report = {
        status: 'Checking dependencies',
        paths: {
            cwd: process.cwd(),
            dirname: __dirname,
            env: process.env.NODE_ENV,
            node: process.version
        },
        results: {}
    };

    const check = (label, requirePath) => {
        try {
            const resolvedPath = require.resolve(requirePath);
            require(requirePath);
            report.results[label] = `OK (${resolvedPath})`;
        } catch (e) {
            report.results[label] = `FAILED: ${e.message}`;
        }
    };

    // Direct string requires so Vercel bundler includes them
    check('express', 'express');
    check('cors', 'cors');
    check('axios', 'axios');
    check('multer', 'multer');
    check('dotenv', 'dotenv');
    check('@supabase/supabase-js', '@supabase/supabase-js');
    check('sharp', 'sharp');
    check('fs', 'fs');
    check('path', 'path');
    report.note = 'Local modules are bundled only with the main handler; this check focuses on external deps.';

    res.json(report);
};
