const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Almacenar clientes conectados
let clients = [];
let sensorData = {
  temperature: [],
  humidity: [],
  timestamps: []
};

// Configuración WebSocket
wss.on('connection', (ws) => {
  console.log('Nuevo cliente conectado');
  clients.push(ws);
  
  // Enviar datos históricos al nuevo cliente
  ws.send(JSON.stringify({
    type: 'historical',
    data: sensorData
  }));
  
  ws.on('message', (message) => {
    console.log('Mensaje recibido:', message.toString());
  });
  
  ws.on('close', () => {
    console.log('Cliente desconectado');
    clients = clients.filter(client => client !== ws);
  });
});

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint para recibir datos del ESP32 (alternativo por HTTP)
app.post('/data', express.json(), (req, res) => {
  const { temperature, humidity } = req.body;
  
  if (temperature !== undefined && humidity !== undefined) {
    const timestamp = Date.now();
    
    // Almacenar datos (mantener últimos 50 puntos)
    sensorData.temperature.push({ x: timestamp, y: temperature });
    sensorData.humidity.push({ x: timestamp, y: humidity });
    sensorData.timestamps.push(timestamp);
    
    if (sensorData.temperature.length > 50) {
      sensorData.temperature.shift();
      sensorData.humidity.shift();
      sensorData.timestamps.shift();
    }
    
    // Enviar a todos los clientes WebSocket
    const newData = {
      type: 'update',
      temperature: temperature,
      humidity: humidity,
      timestamp: timestamp
    };
    
    broadcast(JSON.stringify(newData));
    res.json({ status: 'success' });
  } else {
    res.status(400).json({ error: 'Datos inválidos' });
  }
});

// Función para enviar a todos los clientes
function broadcast(data) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {  // '0.0.0.0' para aceptar conexiones de cualquier IP
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📍 Accede localmente: http://localhost:${PORT}`);
 // console.log(`📍 Accede desde red: http://[TU-IP-LOCAL]:${PORT}`);
});