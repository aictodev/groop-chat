module.exports = (req, res) => {
    const report = {
        status: 'Checking dependencies',
        paths: {
            cwd: process.cwd(),
            dirname: __dirname,
            env: process.env.NODE_ENV
        },
        results: {}
    };

    const tryLoad = (name) => {
        try {
            require(name);
            report.results[name] = 'OK';
        } catch (e) {
            report.results[name] = `FAILED: ${e.message}`;
        }
    };

    tryLoad('express');
    tryLoad('cors');
    tryLoad('axios');
    tryLoad('multer');
    tryLoad('uuid');
    tryLoad('dotenv');
    tryLoad('@supabase/supabase-js');
    tryLoad('fs');
    tryLoad('path');

    // Try to load local modules
    try {
        require('../database');
        report.results['./database'] = 'OK';
    } catch (e) {
        report.results['./database'] = `FAILED: ${e.message}`;
    }

    try {
        require('../auth');
        report.results['./auth'] = 'OK';
    } catch (e) {
        report.results['./auth'] = `FAILED: ${e.message}`;
    }

    res.json(report);
};
