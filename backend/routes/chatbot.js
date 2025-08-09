const express = require('express');
const router = express.Router();

// Chatbot endpoint stub (not active per user's request)
router.post('/', async (req, res) => {
  // For now return a TODO message. Implementation would call OpenAI and then modify site files.
  return res.json({ status: 'inactive', message: 'Chatbot endpoint is implemented but inactive in this prototype.' });
});

module.exports = router;