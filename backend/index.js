require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const mkdirp = require('mkdirp');

const siteRoutes = require('./routes/site');
const chatbotRoutes = require('./routes/chatbot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));
app.use('/sites', express.static(path.join(__dirname, '..', 'frontend', 'sites')));
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'ejs');

// Ensure public/sites exists
mkdirp.sync(path.join(__dirname, '..', 'frontend', 'sites'));

app.use('/api/site', siteRoutes);
app.use('/api/chatbot', chatbotRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});