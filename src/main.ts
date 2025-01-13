import express, {Response, Request} from 'express';
import path, {dirname} from 'path';
import * as http from "node:http";
import pg, {ClientConfig} from 'pg'
import * as fs from "node:fs";
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const {Client} = pg;

class httpServer {
    public app: express.Application;
    private readonly port: number = 3000;
    private dbClient: pg.Client | undefined = undefined;

    constructor() {
        this.app = express();
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '..')));
        this.app.use(express.static(path.join(__dirname, '..', 'static')));
        this.app.use(express.static('public', {
            setHeaders: (res, path) => {
                if (path.endsWith('.js')) {
                    res.set('Content-Type', 'application/javascript');
                }
            }
        }));

        this.port = 3000;

        http.createServer(this.app).listen(this.port, () => {
            console.log(`Server started on port ${this.port}.\n http://localhost:${this.port}`);
        });
    }

    public async dbConnect(config: ClientConfig) {
        try {
            this.dbClient = new Client(config);
            await this.dbClient.connect();
        } catch (e) {
            console.error(e);
        }
    }

    public async dbExecute(sql: string, commit: boolean, values?: string[]): Promise<pg.QueryResult> {
        if (this.dbClient) {
            try {
                await this.dbClient.query('BEGIN');
                const result = this.dbClient.query(sql, values);
                if (commit) {
                    await this.dbClient.query('COMMIT');
                }
                return result;
            } catch (e) {
                await this.dbClient.query('ROLLBACK');
            }
        }
        throw new Error('Not connected to DB');
    }
}

try {
    const server = new httpServer();
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pg.json')).toString());
    await server.dbConnect(config);

    server.app.get('/', (req, res) => {
        res.sendFile(path.resolve('static/html/index.html'));
    });

    server.app.get('/procedure', async (req, res) => {
        try {
            const {id} = req.query;
            const sql = `SELECT * FROM public.procedure `
                + (id ? `WHERE id = '${id}'` : '')
            const queryResult = await server.dbExecute(sql, true);
            res.status(200).send(queryResult.rows);
        } catch (e) {
            console.error(e);
            res.status(400).send(e);
        }
    });

    server.app.put('/procedure', async (req, res) => {
        try {
            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw new Error('Empty body');
            }
            const sql = `INSERT INTO public.procedure (id, value, hardness) ` +
                `VALUES ('${body.id}', '${body.value}', '${body.hardness}')`
            await server.dbExecute(sql, true);
            res.status(200).send();
        } catch (e) {
            console.error(e);
            res.status(400).send(e);
        }
    });

    server.app.get('/shift', async (req, res) => {
        try {
            const { id } = req.query;
            const sql = 'SELECT * FROM public.shift '
                + (id ? `WHERE id = '${id}' ` : '');
            const queryResult = await server.dbExecute(sql, true);
            res.status(200).send(queryResult.rows);
        } catch (e) {
            console.error(e);
            res.status(400).send(e);
        }
    });

    server.app.post('/shift', async (req, res) => {
        try {
            const {id, entryId} = req.query;
            if (!id) {
                throw new Error('Empty id');
            }
            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw new Error('Empty body');
            }
            let sql: string;
            if (entryId) {
                const entry = body.entry;
                if (entry.remove) {
                    sql = `DELETE FROM public.entry WHERE id = '${entryId}'`;
                    await server.dbExecute(sql, false);
                } else {
                    sql = `INSERT INTO public.entry (id, fio, procedure) ` +
                        `VALUES ('${entry.id}', '${entry.fio}', '${entry.procedure}') `;
                    await server.dbExecute(sql, false);
                }
            }
            const set =
                [(body.itemId
                    ? (body.remove
                        ? `entries = array_remove(entries, '${body.itemId}')`
                        : `entries = array_append(entries, '${body.itemId}')`)
                    : '')
                , (body.date
                    ? `date = '${body.date}'`
                    : '')
                , (body.procedures
                    ? `procedures = CAST(ARRAY[${body.procedures}] as uuid[])`
                    : '')]
            sql = `UPDATE public.shift `
                + `SET `
                + set.filter(value => value.length > 0).join(', ') + ' '
                +`WHERE id = '${id}' `
                + (body.itemId
                    ? (body.remove
                        ? `AND '${body.itemId}' = ANY(entries)`
                        : `AND '${body.itemId}' != ALL(entries)`)
                    : '')
            await server.dbExecute(sql, true);
            res.status(200).send();
        } catch (e) {
            console.error(e);
            res.status(400).send(e);
        }
    });

    server.app.put('/shift', async (req, res) => {
        try {
            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw new Error('Empty body');
            }
            const sql = `INSERT INTO public.shift (id, date, procedures) ` +
                `VALUES ('${body.id}', '${body.date}', CAST(ARRAY[${body.procedures}] as uuid[]))`
            await server.dbExecute(sql, true);
            res.status(200).send();
        } catch (e) {
            console.error(e);
            res.status(400).send(e);
        }
    });

    server.app.delete('/shift', async (req, res) => {
        try {
            const {id} = req.query;
            if (!id) {
                throw new Error('Empty id');
            }
            let sql = `SELECT entries FROM public.shift WHERE id = '${id}'`;
            const entries: string[] = (await server.dbExecute(sql, true)).rows[0].entries;
            if (entries.length > 0) {
                sql = `DELETE FROM public.entry ` +
                    `WHERE id IN (${entries.map(entry => `'${entry}'`).join(', ')})`;
                await server.dbExecute(sql, false);
            }
            sql = `DELETE FROM public.shift ` +
                `WHERE id = '${id}'`
            await server.dbExecute(sql, true);
            res.status(200).send();
        } catch (e) {
            console.error(e);
            res.status(400).send(e);
        }
    });

    server.app.get('/entry', async (req, res) => {
        try {
            const {id} = req.query;
            const sql = `SELECT * FROM public.entry `
                + (id
                    ? `WHERE id = '${id}' `
                    : '');
            const queryResult = await server.dbExecute(sql, true);
            res.status(200).send(queryResult.rows);
        } catch (e) {
            console.error(e);
            res.status(400).send(e);
        }
    });

    server.app.post('/entry', async (req: Request, res: Response) => {
        try {
            const {id} = req.query;
            if (!id) {
                throw new Error('Empty id');
            }
            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw new Error('Empty body');
            }
            const set = [(body.fio
                ? `fio = '${body.fio}'`
                : '')
            , (body.procedure
                ? `procedure = '${body.procedure}'`
                : '')];
            const sql = 'UPDATE public.entry '
                + 'SET '
                + set.filter(value => value.length > 0).join(', ') + ' '
                + `WHERE id = '${id}'`
            await server.dbExecute(sql, true);
            res.status(200).send();
        } catch (e) {
            console.error(e);
            res.status(400).send(e);
        }
    });

    server.app.put('/entry', async (req: Request, res: Response) => {
        try {
            const body = req.body;
            if (Object.keys(body).length === 0) {
                throw new Error('Empty body');
            }
            const sql = `INSERT INTO public.entry (id, fio, procedure) `
                + `VALUES ('${body.id}', '${body.fio}', '${body.procedure}') `;
            await server.dbExecute(sql, true);
            res.status(200).send();
        } catch (e) {
            console.error(e);
            res.status(400).send(e);
        }
    });

    server.app.delete('/entry', async (req, res) => {
        try {
            const {id} = req.query;
            if (!id) {
                throw new Error('Empty id');
            }
            const sql = `DELETE FROM public.entry WHERE id = '${id}'`;
            await server.dbExecute(sql, true);
            res.status(200).send();
        } catch (e) {
            console.error(e);
            res.status(400).send(e);
        }
    });

} catch (e) {
    console.error(e);
}
