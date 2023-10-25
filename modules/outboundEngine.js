
const nodemailer = require('nodemailer')
const cron = require('node-cron')
const {sendTaskCompletionEmail}= require('./emailSender')

const taskModel = require('../models/taskSchema');

function stopCronJob(taskName) {
    if (global.cronJobs[taskName]) { 
        global.cronJobs[taskName].stop();
        console.log(`Cron job for ${taskName} has been stopped.`);
        console.log("current jobs =" + cronJobs)
    } else {
        console.log(`No cron job found for ${taskName}.`);
    }
}



function sendOutbound(senderEmail, senderPassword, senderName, subject, body, emailList, nameList, sendingRate, taskName, outboundName) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: senderEmail,
            pass: senderPassword
        }
    })




    let index = 0;
    let cronSchedule = `*/${sendingRate} * * * * *`;
    console.log(sendingRate)
    const sending = cron.schedule(cronSchedule, () => {



        


        if (index <= emailList.length) {
            const recieverName = nameList[index]
            const reciverEmail= emailList[index]
            
                   
                    emailContent = `Hello ${recieverName},\n\n${body}`
                    const mailOptions = {
                        from: `"${senderName}" <${senderEmail}>`,
                        to: reciverEmail ,
                        subject: subject,
                        text: emailContent
                    };


                   console.log(" sending to :" + reciverEmail)


                    transporter.sendMail(mailOptions, function (error, info) {
                        if (error) {
                            reject("failed to send");
                        } else {
                            resolve("email sent");
                        }
                    });
            index = index + 1;
        }
        else {
            //  stopSending()
            console.log("finished")
            sending.stop
        }


    }, { scheduled: false })

    sending.start()

    let requiredTime = (emailList.length * sendingRate) + 1;
    let timerTime = requiredTime * 1000
    setTimeout(() => {
        console.log("terminating TasK")

        sending.stop()

        taskModel.findOneAndUpdate({ taskName: taskName }, { $set: { status: 'completed' } }, { new: true })
            .then((updatedDocument) => {
                if (updatedDocument) {
                     sendTaskCompletionEmail(senderEmail, outboundName ,taskName)
                } else {
                    console.log('No document found for the given taskName');
                }
            })
            .catch(err => {
                console.error('Error updating document:', err);
            });


        stopCronJob(taskName) 

    }, timerTime) 


    //   


}

module.exports = {
    sendOutbound: sendOutbound
};