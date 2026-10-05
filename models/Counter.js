const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

async function getNextSequence(name, startingAt = 0) {
    let counter = await Counter.findById(name);
    if (!counter) {
        counter = await Counter.create({ _id: name, seq: startingAt });
    }
    counter = await Counter.findByIdAndUpdate(
        name,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
}

module.exports = { Counter, getNextSequence };
