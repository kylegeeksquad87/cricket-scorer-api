# Cricket Scorer API

A simple Express.js CRUD API backed by SQLite3, ready to deploy with Docker.

## Endpoints

- `POST   /scores` — Create a new score
- `GET    /scores` — Get all scores
- `GET    /scores/:id` — Get a single score
- `PUT    /scores/:id` — Update a score
- `DELETE /scores/:id` — Delete a score

## Local Development

```bash
npm install
npm start
```

## Using Docker

```bash
docker build -t cricket-scorer-api .
docker run -p 3000:3000 cricket-scorer-api
```

## Database

A SQLite file `cricket_scorer.db` is created in the container/app directory.

## Example Request

```bash
curl -X POST http://localhost:3000/scores -H "Content-Type: application/json" -d '{"player":"Sachin","runs":100,"balls":90}'
```
