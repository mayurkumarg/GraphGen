import handelAsyncFunction from "../../utils/asyncFunctionHandler.js";
import CustomError from "../../utils/customError.js";
import userModel from "../../models/userModel.js";
import generateToken from "../../service/token.js";
import { mailForgotPassword } from "../../service/email.js";


const forgotPassword = handelAsyncFunction(async (req,res,next)=>{
    
    //~ forgot password
    
    //^ extract the feilds from the body
    const {email} = req.body;

    //^ raise error f user not specified the email and password
    if( !email )
        return next(new CustomError(400,"Email is required feild."));

    //^ check for the user on the database
    const user = await userModel.findOne({email});

    //^ if no user exists raise the error of account not exists
    if( !user )
        return next(new CustomError(400,`No user exists with email ${email}. Please try again.`));

    //^ if exists generate the token and mail the token to the specified email address

    const token = generateToken();
    const tokenExpire = Date.now() + 10 * 60 * 1000;


    //^ link for the changing og the password
    const resetLink = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${token}`;

    user.token = token;
    user.tokenExpires = tokenExpire;

    await user.save();

    //^ mail the password reset link to the user email address
    let emailSent = true;
    try {
        await mailForgotPassword(user.name,resetLink,email);
    } catch (error) {
        emailSent = false;

        if (process.env.NODE_ENV !== "DEV") {
            return next(new CustomError(502,"Password reset email could not be sent. Please try again later."));
        }
    }

    //? notify user that the reset password link as sent to email
    res.status(200).send({
        status:"success",
        message: emailSent
            ? `An email has been sent to ${email}. Please click the link to reset your password.`
            : `Password reset email could not be sent from this local environment. DEV reset link: ${resetLink}`,
        ...(emailSent ? {} : { resetLink })
    })

})


export {
    forgotPassword
};
