const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

mongoose.connect('mongodb://localhost:27017/googlepayclone', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));

const userSchema = new mongoose.Schema({
    phoneNum: { type: String, unique: true, required: true },
    availableAmount: { type: Number, default: 0 }
});

const transactionSchema = new mongoose.Schema({
    from: String,
    to: String,
    amount: Number,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

app.use(bodyParser.json());

app.post('/login', async (req, res) => {
    const { phoneNum } = req.body;
    let user = await User.findOne({ phoneNum });

    if (!user) {
        const initialAmount = req.body.initialAmount || 0;
        user = new User({ phoneNum, availableAmount: initialAmount });
        await user.save();
    }

    res.json({ success: true, user });
});

app.post('/transfer', async (req, res) => {
    const { from, to, amount } = req.body;

    try {
        const sender = await User.findOne({ phoneNum: from });
        const recipient = await User.findOne({ phoneNum: to });

        if (!sender || !recipient) {
            return res.json({ success: false, message: 'Invalid phone number(s). Please check and try again.' });
        }

        if (sender.availableAmount < amount) {
            return res.json({ success: false, message: 'Insufficient balance. Transaction failed.' });
        }

        sender.availableAmount -= amount;
        recipient.availableAmount += amount;

        await sender.save();
        await recipient.save();

        const transaction = new Transaction({ from, to, amount });
        await transaction.save();

        handleCashback(amount);

        res.json({ success: true, message: 'Transaction successful.' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: 'An error occurred during the transaction.' });
    }
});

app.get('/user/:phoneNum', async (req, res) => {
    const user = await User.findOne({ phoneNum: req.params.phoneNum });
    res.json({ success: true, user });
});

app.get('/transactions/:phoneNum', async (req, res) => {
    const transactions = await Transaction.find({ $or: [{ from: req.params.phoneNum }, { to: req.params.phoneNum }] });
    res.json({ success: true, transactions });
});

function handleCashback(amount) {
    if (amount % 500 === 0) {
        console.log('Better luck next time! No cashback for multiples of 500.');
        return;
    }

    const cashbackPercentage = amount < 1000 ? 5 : 2;
    const cashbackAmount = (cashbackPercentage / 100) * amount;

    console.log(`Congratulations! You received ${cashbackPercentage}% cashback: ${cashbackAmount}.`);
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
