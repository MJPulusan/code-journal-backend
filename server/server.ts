/* eslint-disable @typescript-eslint/no-unused-vars -- Remove me */
import 'dotenv/config';
import pg from 'pg';
import express from 'express';
import { ClientError, errorMiddleware } from './lib/index.js';

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const app = express();
app.use(express.json());

app.get('/api/entries', async (req, res, next) => {
  try {
    const sql = `
      SELECT *
      FROM "entries"
    `;
    const result = await db.query(sql);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/entries/:entryId', async (req, res, next) => {
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

app.post('/api/entries', async (req, res, next) => {
  try {
    const { title, photoUrl, notes } = req.body;

    if (!title || !photoUrl || !notes) {
      throw new ClientError(400, 'All fields are required');
    }

    const sql = `
      insert into "entries"("title", "photoUrl", "notes")
      values($1, $2, $3)
      returning *;
    `;

    const params = [title, photoUrl, notes];
    const result = await db.query(sql, params);
    const newEntry = result.rows[0];

    res.status(201).json(newEntry);
  } catch (err) {
    next(err);
  }
});

app.put('/api/entries/:entryId', async (req, res, next) => {
  try {
    const { entryId } = req.params;
    const { title, photoUrl, notes } = req.body;

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
      where "entryId" = $4
      returning *;
    `;
    const params = [title, photoUrl, notes, entryId];
    const result = await db.query(sql, params);
    const updatedEntry = result.rows[0];

    if (!updatedEntry) {
      throw new ClientError(404, `Actor with ID ${entryId} not found`);
    }

    res.status(200).json(updatedEntry);
  } catch (err) {
    next(err);
  }
});

app.delete(`/api/entries/:entryId`, async (req, res, next) => {
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

app.use(errorMiddleware);

app.listen(process.env.PORT, () => {
  console.log(`express server listening on port ${process.env.PORT}`);
});
