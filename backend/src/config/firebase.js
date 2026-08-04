// Consolidated into ./firebase-admin, which is now the single initialization
// site for the server process (IMP-001). Kept as a thin re-export so that any
// straggling `require('../config/firebase')` resolves to that one module
// instead of initializing a second Firebase app.
module.exports = require('./firebase-admin');
