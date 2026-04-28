require('dotenv').config({ path: '.env.example' });
process.env.JWT_SECRET = 'test_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.MONGO_URI = 'mongodb://localhost:27017/chatapp_test';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../src/index');

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('Auth API', () => {
  const user = { name: 'Test User', email: 'test@nexchat.dev', password: 'password123' };

  test('POST /api/auth/signup — should create user', async () => {
    const res = await request(app).post('/api/auth/signup').send(user);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('POST /api/auth/login — should login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
  });

  test('POST /api/auth/login — invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});

describe('Health Check', () => {
  test('GET /health — should return ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
