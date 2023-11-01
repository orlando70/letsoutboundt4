require('dotenv').config()
const express = require("express");
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcryt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const userModel = require('./models/userSchema');
const emailModel = require('./models/emailSchema')
const outBoundModel = require('./models/outboundSchema');
const taskModel = require('./models/taskSchema')
const port = process.env.PORT||3000;
const { sendRegistrationCode, sendOutboundEmailNotFound, sendOutboundEmailDataNotFound } = require('./modules/emailSender')
const cron = require('node-cron')
global.cronJobs = {}
const emailSender = require('./modules/outboundEngine');
const path= require('path')


const app = express();
app.use(cors());
app.use(bodyParser.json())

//set up cron jobs

// const __dirname = path.resolve();

function setupCronJob(taskName, schedule, taskFunction) {
    console.log('starting cron...')
    global.cronJobs[taskName] = cron.schedule(schedule, taskFunction);
    console.log('task registration complete...')
}






// send registration code
app.post("/sendregisterationcode", async (req, res) => {
    try {
        const { recieverName, reciverEmail, code } = req.body
        const mailSent = await sendRegistrationCode(recieverName, reciverEmail, code);
        if (mailSent === "email sent") {
            res.status(200).json({ message: mailSent })
        }
    } catch (error) {
        res.status(400).json(error.message)
    }
})

app.post("/finduser", async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userModel.findOne({ email: email })
        if (!user) {
            return res.status(200).json({ message: "not-found" });
        }
        res.status(200).json({ message: "found" })
    }
    catch (error) {
        res.status(400).json(error.message);
    }
})
app.post("/findemail", async (req, res) => {
    try {
        const { emailAddress } = req.body;
        const emailCheck = await emailModel.findOne({ emailAddress: emailAddress })
        if (!emailCheck) {
            return res.status(200).json({ message: "not-found" });
        }
        res.status(200).json({ message: "found" })
    }
    catch (error) {
        res.status(400).json(error.message);
    }
})


app.post("/updatedaysassigned", async (req, res) => {
    try {
        const { email, days } = req.body
        // Find the document by its email address
        const findEmail = await emailModel.findOne({ emailAddress: email })
        if (!findEmail) {
            return res.status(200).json({ message: "emailnotfound" })
        }

        const pushed = findEmail.daysAssigned.push(days)

        if (!pushed) {
            res.status(200).json({ message: "could not push" })
        }

        findEmail.save();
        res.status(200).json(findEmail);

    } catch (error) {
        res.status(400).json(error.message)
    }
})


app.post("/registeremail", async (req, res) => {
    try {
        const { ownerAccount, emailAddress, password, senderName, signature, dailySendingCapacity } = req.body;
        const user = await userModel.findOne({ email: ownerAccount })
        const hashedpassword = await bcryt.hash(password, 10);
        const newEmail = await emailModel.create({ ownerAccount, emailAddress, password, senderName, signature, dailySendingCapacity })
        res.status(200).json({ message: "registrationComplete" })
    }
    catch (error) {
        res.status(400).json(error.message);
    }
})
app.post("/registeroutbound", async (req, res) => {
    try {

        const { ownerAccount, outboundName, emailList } = req.body;
        const outbound = await outBoundModel.findOne({ outboundName: outboundName })
        if (outbound) { return res.status(200).json({ message: "already-exist" }) }
        const newOutbound = await outBoundModel.create({ ownerAccount, outboundName, emailList, tasks: 0 })
        res.status(200).json({ message: "registrationComplete" })
    }
    catch (error) {
        res.status(400).json(error.message);
    }
})




app.post("/registertask", async (req, res) => {
    try {

        const { ownerAccount, outboundName, taskName, taskDate, taskTime, taskSendingRate, taskSubject, taskBody } = req.body;


        function taskFunction() {
            console.log('Im in task function')
            
            const thisUserRegisteredEmails = []
            //get all user registed email list
            emailModel.find({ ownerAccount: ownerAccount })
                .then((result) => {
                    result.forEach((item) => {
                        thisUserRegisteredEmails.push(item.emailAddress)
                    })
                })
                .catch(error => console.log(error))

                //get the Partcular Outbound
            outBoundModel.findOne({ outboundName: outboundName })
                .then((result) => {

                    
                        const emailList = result.emailList

                        emailList.forEach(async element => {

                           try{
                            const senderEmail = element.allocatedEmail;
                            console.log("sender email is: " + senderEmail)
                            const mailData = await emailModel.findOne({ emailAddress: senderEmail })
                            const senderName = mailData.senderName
                            const senderSignature = mailData.signature
                            const senderPassword = mailData.password;
                            const newBody = taskBody + "\n\n" + senderSignature

                            //check if the email has not been deleted.
                            if (thisUserRegisteredEmails.some(item => item === senderEmail)) {
                                let sent = emailSender.sendOutbound(senderEmail, senderPassword, senderName, taskSubject, newBody, element.emailAllocations, element.nameAllocations, taskSendingRate, taskName, outboundName)
                            }
                            else { 
                                //send an email to the owner telling him that he deleted the email required to  send a task
                                sendOutboundEmailNotFound(ownerAccount, outboundName, taskName, senderEmail)
                            }
                           }
                           catch(error){
                            sendOutboundEmailDataNotFound(ownerAccount,outboundName,taskName)
                           }


                        });
                    
                   



                })
                .catch((error) => {
                    return res.status(400).json(error.message)
                })

        }

        const [year, month, day] = taskDate.split('-').map(Number);
        const [hour, minute] = taskTime.split(':').map(Number);
        const scheduledDate = new Date(year, month - 1, day, hour, minute);
        const cronSchedule = `${minute} ${hour} ${day} ${month} *`;




        console.log('task registration ongoing...')

        setupCronJob(taskName, cronSchedule, taskFunction)
        //console.log("current jobs =" + (cronJobs))








        //save task
        const newTask = await taskModel.create({ ownerAccount, outboundName, taskName, taskDate, taskTime, taskSendingRate, taskSubject, taskBody, status: "pending" })


        //update taskCount

        outBoundModel.findOne({ outboundName: outboundName })
            .then((result) => {
                if (result) {
                    let taskCount = result.tasks;
                    let newCount = taskCount + 1;


                    return outBoundModel.findOneAndUpdate({ outboundName: result.outboundName }, { $set: { tasks: newCount } });
                } else {
                    // Handle the case where no document was found with the given outboundName
                    console.log('Document not found');
                    return null;
                }
            })
            .then((updatedDocument) => {
                if (updatedDocument) {

                }
            })
            .catch(err => console.log(err));





        res.status(200).json({ message: "registrationComplete" })

    }
    catch (error) {
        res.status(400).json(error.message);
    }
})
app.post("/register", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        const hashedpassword = await bcryt.hash(password, 10);
        const newUser = await userModel.create({ firstName, lastName, email, password: hashedpassword })
        res.status(200).json({ message: "registrationComplete" })
    }
    catch (error) {
        res.status(400).json(error.message);
    } 
})
//login
app.post("/login", async (req, res) => {
    const { email, password } = req.body
    const user = await userModel.findOne({ email: email })
    if (!user) {
        return res.status(200).json({ message: "not-registered" })
    }
    const isPasswordValid = await bcryt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(200).json({ message: "wrong-password" })
    }
    const token = jwt.sign({ userID: user._id }, process.env.SECRETE_KEY, { expiresIn: "1hr" })
    res.status(200).json({ message: "login-success", token: token, userData: user })
})

app.post("/getuseroutbounds", async (req, res) => {
    try {
        const { ownerAccount } = req.body;
        const userOutbounds = await outBoundModel.find({ ownerAccount: ownerAccount });
        if (!userOutbounds) {
            return res.status(200).json({ message: "no-outbound-registered" })
        }
        return res.status(200).json({ message: "outbounds-found", data: userOutbounds })

    } catch (error) {
        return res.status(400).json(error.message)
    }
})
app.post("/getuseroutboundemails", async (req, res) => {
    try {
        const { ownerAccount } = req.body;
        const userEmails = await emailModel.find({ ownerAccount: ownerAccount });
        if (!userEmails) {
            return res.status(200).json({ message: "no-emails-registered" })
        }
        return res.status(200).json({ message: "emails-found", data: userEmails })

    } catch (error) {
        return res.status(400).json(error.message)
    }
})
app.post("/getusertasks", async (req, res) => {
    try {
        const { ownerAccount } = req.body;
        const userTasks = await taskModel.find({ ownerAccount: ownerAccount });
        if (!userTasks) {
            return res.status(200).json({ message: "no-task-found" })
        }
        return res.status(200).json({ message: "tasks-found", data: userTasks })

    } catch (error) {
        return res.status(400).json(error.message)
    }
})




app.post("/deleteOutbound", async (req, res) => {

    const { outboundName, ownerAccount } = req.body;

    try {
        // Delete documents from outBoundModel
        const outBoundResult = await outBoundModel.deleteMany({ outboundName, ownerAccount });
        console.log(`${outBoundResult.deletedCount} document(s) deleted from outBoundModel.`);
    } catch (err) {
        console.error("Error deleting documents from outBoundModel:", err);
    }


    try {
        const tasks = await taskModel.find({ outboundName: outboundName })

        for (let i = 0; i < tasks.length; i++) {
            let taskName = tasks[i].taskName
            if (global.cronJobs[taskName]) {
                global.cronJobs[taskName].stop();
                console.log(`Cron job for ${taskName} has been stopped.`);
                console.log("current jobs =" + cronJobs)
            } else {
                console.log(`No cron job found for ${taskName}.`);
            }
        }
    }
    catch (error) { console.error("Error findiing documents from taskModel:", err); }

    try {
        // Delete documents from taskModel
        const taskResult = await taskModel.deleteMany({ outboundName });
        console.log(`${taskResult.deletedCount} document(s) deleted from taskModel.`);
    } catch (err) {
        return res.status(200).json(err)
    }

    res.status(200).json({ message: "outbond-deleted" })

})
app.post("/deleteEmail", async (req, res) => {

    const { emailAddress, ownerAccount } = req.body;

    try {
        // Delete documents from outBoundModel
        const emailDeleteResult = await emailModel.deleteMany({ emailAddress, emailAddress });
        if (emailDeleteResult) {
            return res.status(200).json({ message: "email-deleted" })
        }
        else {
            return res.status(200).json({ message: "email-not-deleted" })
        }

    } catch (err) {
        console.error("Error deleting documents from emailModel:", err);
    }

})




























app.use(express.static(path.join(__dirname, "client/build")))
console.log( "__dirnames is: "+__dirname)

app.get("*", (req, res)=>{
    res.sendFile(
        path.join(__dirname,"client/build/index.html")
    )
})




mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(port, () => {
            console.log("Connected to port " + port + " and Database")
        })
    })
    .catch((error) => {
        console.log("Could not connect to DataBase")
    })

//"Could not connect to DataBase"
