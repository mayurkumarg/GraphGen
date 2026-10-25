import userModel from "./../../models/userModel.js"
import CustomError from "../../utils/customError.js";
import handelAsyncFunction from "../../utils/asyncFunctionHandler.js";

const createUser = handelAsyncFunction( async (req,res,next) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return next(new CustomError(400,"Name, email, and password are required."));
    }

    const userExists = await userModel.findOne({ email });
    if (userExists) {
        return next(new CustomError(400,"User already exists."));
    }

    const user = await userModel.create({ name, email, password, verified: true });

    res.status(201).send({
        status:"success",
        message:"Account created successfully. You can now sign in.",
        user: {
            name: user.name,
            email: user.email,
        }
    })
} ); 




export default createUser;
