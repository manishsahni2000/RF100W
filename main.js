let app = null
let realmApp = null
const realm_id = "nublar" // This is use to let us store multiple Realms in one Database

const GRIDSIZE = 8

function showError(error){
    app.lastError = error;
}

function logInUser() {
    let user = document.getElementById("username").value
    let pass = document.getElementById("password").value
    let credentials = Realm.Credentials.emailPassword(user, pass);

    realmApp.logIn(credentials).then(() => location.reload()).catch(e => {
        document.getElementById("loginerror").innerHTML = e.message
        console.log(e)
    })
}

function logOutUser() {
    realmApp.currentUser.logOut().then(() => location.reload()).catch(e => {
        document.getElementById("errors").innerHTML = e.message
        console.log(e)
    })
}

function initialiseData() {
    for (x = 0; x < GRIDSIZE * GRIDSIZE; x++) {
        let sr = new SurveyResult(x)
        app.surveyResults.push(sr)
        sr.createOrRetrieve(); //Fetch from the DB or add
    }
}

function squareClicked(which) {
  
    app.selectedResult = which

  
    app.sliders.visitors = which.visitors
    app.sliders.herbivores = which.herbivores
    app.sliders.carnivores = which.carnivores
    app.notes = which.getNote()
  
}

function sliderChange(type) {
    if (app.selectedResult != null) {
        app.selectedResult.setValue(type, parseInt(app.sliders[type]))
    }
}

 function notesChanged(evt) {

    let inputType = evt.inputType
    let offset = evt.target.selectionStart
    if (evt.data == null && inputType == "insertText") {
        inputType = "insertLineBreak"; //Newline at the end
    }
    if (app.selectedResult) {
         app.selectedResult.updateNote(app.notes, inputType, offset)
    }
}
async function watchForSurveyChanges()
{
    //Watch for changes
    console.log("Watching Survey")

    const mongodb = realmApp.currentUser.mongoClient("mongodb-atlas");
    const dinodb  = mongodb.db("dino")
    var surveyresultscollection = dinodb.collection("SurveyResult");
    for await (const change of surveyresultscollection.watch({operationType: "update"})) {
                if(change.fullDocument.writer != app.sessionguid  &&  change.updateDescription && 
                    Object.keys(change.updateDescription.updatedFields).length) {
        
                sr = app.surveyResults[change.fullDocument.gridsquare]
                await sr.applyChange(change)
                if(sr == app.selectedResult) {
                    squareClicked(sr)
                }
        }
    }  
}
async function watchForNoteChanges()
{

    const mongodb = realmApp.currentUser.mongoClient("mongodb-atlas");
    const dinodb  = mongodb.db("dino")
    var surveynotescollection = dinodb.collection("SurveyNote");

    for await (const change of surveynotescollection.watch({operationType: "update"})) {
        if(change.fullDocument &&
            change.fullDocument.writer != app.sessionguid  && 
            change.updateDescription && 
            Object.keys(change.updateDescription.updatedFields).length) {
            resultloop:
            for( result of app.surveyResults) {
                for (note of result.notes) {
                    if(note.affectedBy(change)) {
                        await result.createOrRetrive()
                        if(app.selectedResult == result) {
                            squareClicked(result)
                        }
                            break resultloop
                        }
                    }
                }
            }             
        }
}


function onLoad() {
    sessionguid = new Realm.BSON.ObjectId(); 
    app = new Vue({
        el: '#app',
        comments: true,
        data: {
            loginVisible: true,
            surveyResults: [],
            selectedResult: null,
            sliders: { visitors: 0, herbivores: 0, carnivores: 0 },
            notes: "",
            lastError: "",
            sessionguid: sessionguid.toHexString()
        },
        methods: {
            squareClicked: squareClicked,
            sliderChange: sliderChange,
            notesChanged: notesChanged,
            logOutUser: logOutUser,
            logInUser: logInUser
        }
    })

    const realmAppId = "dinorealm-azwmo" //Use YOUR ID
    realmApp = new Realm.App({ id: realmAppId });
     //Are we logged in?

    if (realmApp.currentUser != null) {
        app.loginVisible = false
        initialiseData()
        watchForSurveyChanges()
        watchForNoteChanges()
    } else {
        app.loginVisible = true
    }


        
}
