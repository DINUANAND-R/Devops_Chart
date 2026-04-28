const Redis = require('ioredis');
const logger = require('../utils/logger');

let publisher;
let subscriber;
let client;

const connectRedis = async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  const options = {
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    maxRetriesPerRequest: 3,
  };

  client = new Redis(redisUrl, options);
  publisher = new Redis(redisUrl, options);
  subscriber = new Redis(redisUrl, options);

  try {
    await client.connect();
    await publisher.connect();
    await subscriber.connect();
    logger.info('✅ Redis connected');
  } catch (err) {
    logger.warn(`⚠️  Redis unavailable: ${err.message}. Running without Redis caching/pub-sub.`);
    client = null;
    publisher = null;
    subscriber = null;
  }
};

const getClient = () => client;
const getPublisher = () => publisher;
const getSubscriber = () => subscriber;

module.exports = { connectRedis, getClient, getPublisher, getSubscriber };
