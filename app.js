require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const debuglog = require("debug")("app:");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const mongodb = require("./config/mongo");
const userModel = require("./models/user");
const hisaabModel = require("./models/hisaab");

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());
const port = process.env.PORT || 4000;

app.get("/", isLogin, async (req, res) => {
    let { hisaabs } = await userModel
        .findOne({ email: req.useremail })
        .populate("hisaabs");
    res.render("home", { hisaabs });
});

app.get("/filter", isLogin, async (req, res) => {
    let { date } = req.query;

    if (!date) {
        return res.redirect("/");
    }

    try {
        date = new Date(date);
        let startDate = new Date(date.setHours(0, 0, 0, 0));
        let endDate = new Date(date.setHours(23, 59, 59, 999));
        
        let user = await userModel.findOne({ email: req.useremail }).populate({
            path: 'hisaabs',
            match: { created: { $gte: startDate, $lt: endDate } }
        });

        res.render("home", { hisaabs: user.hisaabs });
    } catch (error) {
        debuglog("Error during filtering:", error);
        res.redirect("/");
    }
});



app.get("/create", isLogin, (req, res) => {
    res.render("create");
});

app.post("/create", isLogin, async (req, res) => {
    let { title, desc, encrypt, passcode, canshare, canedit } = req.body;
    let user = await userModel.findOne({ email: req.useremail });
    encrypt = encrypt === "on";
    canshare = canshare === "on";
    canedit = canedit === "on";
    passcode = !encrypt ? "" : passcode;
    await hisaabModel
        .create({
            title,
            desc,
            encrypt,
            passcode,
            canshare,
            canedit,
            user: user._id,
        })
        .then((hisaab) => {
            user.hisaabs.push(hisaab._id);
            user.save();
            debuglog("hisaab created");
            res.redirect("/");
        })
        .catch((err) => {
            debuglog("error creating hisaab: ", err);
            res.redirect("/create");
        });
});

app.get("/passcode/:hisaabid", isLogin, isAuth, (req, res) => {
    res.render("passcode", { hisaab: req.hisaab });
});

app.post("/verify-passcode/:hisaabid", isLogin, isAuth, async (req, res) => {
    const { passcode } = req.body;
    const { hisaab } = req;
    if (hisaab.encrypt && hisaab.passcode === passcode) {
        res.cookie(`hisaab_${hisaab._id}`, true, { maxAge: 300000 }); // 5 min
        res.redirect(`/view/${hisaab._id}`);
    } else {
        debuglog("Incorrect passcode");
        res.redirect(`/passcode/${hisaab._id}`);
    }
});

app.get("/view/:hisaabid", isLogin, isAuth, isEncrypt, async (req, res) => {
    res.render("view", { hisaab: req.hisaab });
});

app.get("/edit/:hisaabid", isLogin, isAuth, isEncrypt, async (req, res) => {
    let { hisaab } = req;
    if (hisaab.isowner || (!hisaab.isowner && hisaab.canedit))
        return res.render("edit", { hisaab });
    else {
        debuglog("you are not authorized to edit");
        res.redirect("/");
    }
});

app.post("/edit/:hisaabid", isLogin, isAuth, isEncrypt, async (req, res) => {
    let {hisaab} = req;
    if (hisaab.isowner || (!hisaab.isowner && hisaab.canedit)) {
        let { title, desc, encrypt, passcode, canshare, canedit } = req.body;
        encrypt = encrypt === "on";
        canshare = canshare === "on";
        canedit = canedit === "on";
        passcode = !encrypt ? "" : passcode;
        await hisaabModel
            .findByIdAndUpdate(
                req.params.hisaabid,
                { title, desc, encrypt, passcode, canshare, canedit },
                { new: true }
            )
            .then(() => {
                debuglog("hisaab updated");
                res.redirect(`/view/${req.params.hisaabid}`);
            })
            .catch((err) => {
                debuglog("error updating hisaab: ", err);
                res.redirect(`/edit/${req.params.hisaabid}`);
            });
    } else {
        debuglog("you are not authorized to edit");
        res.redirect("/");
    }
});

app.post("/share/:hisaabid", isLogin, isAuth, isEncrypt, async (req, res) => {
    if (req.hisaab.isowner) {
        let { recipient } = req.body;
        let hisaab = await hisaabModel.findById(req.params.hisaabid);
        hisaab.shareable.push(recipient);
        await hisaab.save();
        res.json({
            viewLink: `${req.protocol}://${req.get("host")}/view/${
                req.params.hisaabid
            }`,
        });
    } else {
        debuglog("you are not authorized to share");
        res.redirect("/");
    }
});

app.post("/delete/:hisaabid", isLogin, isAuth, isEncrypt, async (req, res) => {
    if (req.hisaab.isowner) {
        let user = await userModel.findOne({ email: req.useremail });
        await hisaabModel.findByIdAndDelete(req.params.hisaabid);
        // Update the user document to remove the Hisaab reference
        await userModel.findByIdAndUpdate(user._id, {
            $pull: { hisaabs: req.params.hisaabid },
        });
        debuglog("hisaab deleted");
        res.redirect("/");
    } else {
        debuglog("you are not authorized to delete");
        res.redirect("/");
    }
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", (req, res) => {
    let { name, email, password } = req.body;
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            await userModel
                .create({ name, email, password: hash })
                .then(() => {
                    res.cookie(
                        "authtoken",
                        jwt.sign(email, process.env.JWTPASS),
                        {
                            maxAge: 86400 * 1000,
                        }
                    );
                    debuglog("user created and logged in");
                    res.redirect("/");
                })
                .catch((err) => {
                    debuglog("error creating user: ", err);
                    res.redirect("/register");
                });
        });
    });
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    let { email, password } = req.body;
    let user = await userModel.findOne({ email });
    if (!user) {
        debuglog("User not found");
        return res.redirect("/login");
    }
    bcrypt.compare(password, user.password, (err, result) => {
        if (!result) {
            debuglog("Incorrect password");
            return res.redirect("/login");
        }
        res.cookie("authtoken", jwt.sign(email, process.env.JWTPASS), {
            maxAge: 86400 * 1000,
        });
        debuglog("Logged in successfully");
        res.redirect("/");
    });
});

app.get("/logout", isLogin, cleanup, (req, res) => {
    res.clearCookie("authtoken");
    res.redirect("/login");
});

// Error handling middleware 😥


app.listen(port, () => {
    debuglog(`Server is running on port ${port}`);
});

function isLogin(req, res, next) {
    let token = req.cookies.authtoken;
    if (!token) {
        debuglog("you don't have token login required");
        res.redirect("/login");
    } else {
        jwt.verify(token, process.env.JWTPASS, (err, data) => {
            if (err) {
                debuglog("invalid token");
                res.redirect("/login");
            } else {
                req.useremail = data;
                next();
            }
        });
    }
}

async function isAuth(req, res, next) {
    let user = await userModel.findOne({ email: req.useremail });
    let hisaab = await hisaabModel.findById(req.params.hisaabid);

    if (!hisaab) {
        debuglog("hisaab not found");
        return res.redirect("/");
    }

    if (hisaab.user.toString() === user._id.toString()) {
        req.hisaab = hisaab;
        req.hisaab.isowner = true;
        return next();
    } else if (hisaab.shareable.includes(user.email)) {
        req.hisaab = hisaab;
        req.hisaab.isowner = false;
        return next();
    } else {
        debuglog("Unauthorized access to hisaab");
        res.redirect("/");
    }
}

async function isEncrypt(req, res, next) {
    const { hisaab } = req;
    const passcodeCookie = req.cookies[`hisaab_${hisaab._id}`];
    
    if (hisaab.encrypt && !passcodeCookie) {
        return res.redirect(`/passcode/${hisaab._id}`);
    }
    
    next();
}

function cleanup(req, res, next) {
    req.useremail = null;
    req.hisaab = null;
    next();
}


