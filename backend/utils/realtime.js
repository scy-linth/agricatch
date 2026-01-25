const clients = new Set();

function addSseClient(res, user) {
  const client = { res, user, createdAt: Date.now() };
  clients.add(client);

  res.on('close', () => {
    clients.delete(client);
  });

  return client;
}

function broadcastEvent(event, data) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data ?? {});
  for (const client of clients) {
    try {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${payload}\n\n`);
    } catch (_) {
      clients.delete(client);
    }
  }
}

function getClientCount() {
  return clients.size;
}

module.exports = {
  addSseClient,
  broadcastEvent,
  getClientCount
};

