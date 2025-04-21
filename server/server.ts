/* eslint-disable @typescript-eslint/no-unused-vars -- Remove me */
import 'dotenv/config';
import pg from 'pg';
import express from 'express';
import { authMiddleware, ClientError, errorMiddleware } from './lib/index.js';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

type User = {
  userId: number;
  username: string;
  hashedPassword: string;
};
type Auth = {
  username: string;
  password: string;
};

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const hashKey = process.env.TOKEN_SECRET;
if (!hashKey) throw new Error('TOKEN_SECRET not found in .env');

const app = express();
app.use(express.json());

app.get('/api/entries', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const sql = `
      SELECT *
      FROM "entries"
      where "userId" = $1
    `;
    const result = await db.query(sql, [userId]);
    if (result.rows.length === 0) {
      res.status(200).json([]); // Graceful empty state
      return;
    }
    res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/entries/:entryId', authMiddleware, async (req, res, next) => {
  try {
    const entryId = Number(req.params.entryId);
    if (!Number.isInteger(entryId) || entryId < 1) {
      throw new ClientError(400, 'entryId must be a positive integer');
    }

    const sql = `
      SELECT *
      FROM "entries"
      WHERE "entryId" = $1
    `;
    const result = await db.query(sql, [entryId]);
    const entry = result.rows[0];

    if (!entry) {
      throw new ClientError(404, `Entry with ID ${entryId} not found`);
    }

    res.json(entry);
  } catch (err) {
    next(err);
  }
});

app.post('/api/entries', authMiddleware, async (req, res, next) => {
  try {
    const { title, photoUrl, notes } = req.body;
    const userId = req.user?.userId;

    if (!title || !photoUrl || !notes) {
      throw new ClientError(400, 'All fields are required');
    }

    const sql = `
      insert into "entries"("title", "photoUrl", "notes", "userId")
      values($1, $2, $3, $4)
      returning *;
    `;

    const params = [title, photoUrl, notes, userId];
    const result = await db.query(sql, params);
    const newEntry = result.rows[0];

    res.status(201).json(newEntry);
  } catch (err) {
    next(err);
  }
});

app.put('/api/entries/:entryId', authMiddleware, async (req, res, next) => {
  try {
    const { entryId } = req.params;
    const { title, photoUrl, notes } = req.body;
    const userId = req.user?.userId;

    if (!Number(entryId)) {
      throw new ClientError(400, 'entryId must be a positive integer');
    }

    if (!title || !photoUrl || !notes) {
      throw new ClientError(400, 'All fields are required');
    }

    const sql = `
      update "entries"
      set "title" = $1,
          "photoUrl" = $2,
          "notes"= $3
      where "entryId" = $4 and "userId" = $5
      returning *;
    `;
    const params = [title, photoUrl, notes, entryId, userId];
    const result = await db.query(sql, params);
    const updatedEntry = result.rows[0];

    if (!updatedEntry) {
      throw new ClientError(404, `Entry with ID ${entryId} not found`);
    }

    res.status(200).json(updatedEntry);
  } catch (err) {
    next(err);
  }
});

app.delete(`/api/entries/:entryId`, authMiddleware, async (req, res, next) => {
  try {
    const { entryId } = req.params;

    if (!Number(+entryId)) {
      throw new ClientError(400, `${entryId} needs to be a positive Integer`);
    }

    const sql = `
delete from "entries"
where "entryId" = $1
returning *;

    `;
    const result = await db.query(sql, [entryId]);

    if (!result.rows[0]) {
      throw new ClientError(404, `${entryId} not found.`);
    }

    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/sign-up', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new ClientError(400, 'username and password are required fields');
    }

    const hashedPassword = await argon2.hash(password);

    const sql = `
  insert into "users" ("username", "hashedPassword")
  values ($1, $2)
  returning "userId", "username", "createdAt"
`;

    const params = [username, hashedPassword];
    const result = await db.query(sql, params);
    const newUser = result.rows[0];
    res.status(201).json(newUser);
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/sign-in', async (req, res, next) => {
  try {
    const { username, password } = req.body as Partial<Auth>;
    if (!username || !password) {
      throw new ClientError(401, 'invalid login');
    }
    const sql = `
      select *
      from "users"
      where "username" = $1;
    `;

    const params = [username];
    const result = await db.query<User>(sql, params);

    if (result.rows.length === 0) {
      throw new ClientError(401, 'invalid login');
    }

    const user = result.rows[0];
    if (!(await argon2.verify(user.hashedPassword, password))) {
      throw new ClientError(401, 'invalid login');
    }

    const payload = {
      userId: user.userId,
      username: user.username,
    };

    const token = jwt.sign(payload, hashKey);

    res.status(200).json({ user: payload, token });
  } catch (err) {
    next(err);
  }
});

app.use(errorMiddleware);

app.listen(process.env.PORT, () => {
  console.log(`express server listening on port ${process.env.PORT}`);
});
