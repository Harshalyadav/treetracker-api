const express = require('express');
const treeRouter = express.Router();
const Joi = require('joi');

const {
    createTree,
    treeFromRequest
} = require('../models/tree');
const { dispatch } = require('../models/DomainEvent');

const Session = require('../infra/database/Session');
const { publishMessage } = require('../infra/messaging/RabbitMQMessaging');

const {
    TreeRepository,
    CaptureRepository,
    EventRepository,
} = require('../infra/database/PgRepositories');

const treeHandlerGet = async function (req, res) {
    const session = new Session(false);
    // todo
    res.send(result);
    res.end();
};


const treeSchema = Joi.object({
    capture_id: Joi.string().guid(),
    image_url: Joi.string().uri(),
    lat: Joi.number().min(0).max(90),
    lon: Joi.number().min(0).max(180)
});

const treeHandlerPost = async function (req, res) {
    
    const value = treeSchema.validateAsync(req.body);
    console.log(`${error} and value is ${JSON.stringify(value)}`);

    const session = new Session();
    const captureRepo = new TreeRepository(session);
    const eventRepository = new EventRepository(session);
    const executeCreateTree = createTree(captureRepo);

    // const eventDispatch = dispatch(eventRepository, publishMessage);
    const now = new Date().toISOString();
    const tree = treeFromRequest({
        ...req.body,
        created_at: now,
        updated_at: now
    });

    try {
        await session.beginTransaction();
        //const { entity, raisedEvents } = await executeCreateTree(tree);
        const treeEntity = await executeCreateTree(tree);
        await session.commitTransaction();
        /*raisedEvents.forEach((domainEvent) =>
          eventDispatch('capture-created', domainEvent),
        );*/
        res.status(201).json({
            ...treeEntity,
        });
    } catch (e) {
        console.log(e);
        if (session.isTransactionInProgress()) {
            await session.rollbackTransaction();
        }
        let result = e;
        res.status(422).json({ ...result });
    }
};


module.exports = {
    treeHandlerGet,
    treeHandlerPost
};