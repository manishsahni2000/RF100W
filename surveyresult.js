
class SurveyResult {

  constructor(gridsquare) {
    this.gridsquare = gridsquare;
    this.visitors = 0
    this.carnivores = 0
    this.herbivores = 0
    this.notes = []

    const mongodb = realmApp.currentUser.mongoClient("mongodb-atlas");
    const dinodb = mongodb.db("dino")
    this.surveyresultscollection = dinodb.collection("SurveyResult");

  }

  //When we get a change stream event only we know how to interpret it
  async applyChange(change) {
    //console.log(JSON.stringify(change,null,2))
    //We may have new notes, have deleted notes, have modified notes
    //So just reload the whole square
    await this.createOrRetrieve()
  }

  setValue(attribute, value) {
    this[attribute] = value;
    //Update this in Atlas too
    const query = { "gridsquare": this.gridsquare, "realm_id": realm_id }
    let updatefields = { [attribute]: value }
    updatefields.writer = app.sessionguid;

    const update = { $set: updatefields }

    this.surveyresultscollection.updateOne(query, update)
      .catch(err => showError(err))
  }

  async createOrRetrieve() {
    const query = { "gridsquare": this.gridsquare, "realm_id": realm_id }
    let idhex = "00".repeat(12) +  this.gridsquare.toString(16)
    idhex = idhex.substr(-24)
    const id = new Realm.BSON.ObjectId(idhex); //BSON in legacy API
    const update = {
      $setOnInsert: {
        _id : id,
        carnivores: this.carnivores,
        visitors: this.visitors,
        herbivores: this.herbivores,
        writer: app.sessionguid,
        notes: []
      }
    }

    const options = { upsert: true, returnNewDocument: true }
    try {
    let dbrecord = await this.surveyresultscollection.findOneAndUpdate(query, update, options)
    //console.log(`DBRECORD: ${JSON.stringify(dbrecord)}`)
    this._id = dbrecord._id
    this.visitors = dbrecord.visitors
    this.carnivores = dbrecord.carnivores
    this.herbivores = dbrecord.herbivores
    if (dbrecord.notes) {
      this.notes.length=0
        //If we have any notes fetch them as we have stored them as references
        //We could do this as a single find() and then sort to match the array
        for (let noteid of dbrecord.notes) {
          let note = new SurveyNote("")
          if (await note.retrieveFromDatabase(noteid)) {
            this.notes.push(note)
          }
        };
      }
    }
    catch(err) { showError(err) }
  }


  async addNoteLine(txt, index) {

    if( index == null) { index = 0 }
    const note = new SurveyNote(txt);
    this.notes.splice(index, 0, note)
    note.addToDatabase().catch(err => showError(err)); 

    //Also update this in the database
    const query = { "gridsquare": this.gridsquare, "realm_id": realm_id }
    const update = { $set: { writer: app.sessionguid} ,$push: { notes: { $each: [note.id], $position: index } } }

    this.surveyresultscollection.updateOne(query, update).catch(err => showError(err))
  }


  updateNoteLine(txt, index) {
   this.notes[index].setText(txt).catch(err => showError(err))
  }

  async deleteNoteLine(index) {
    const note = this.notes[index];
    const noteid = note.id
    this.notes.splice(index, 1) //Delete
    note.removeFromDatabase();
    //Remove from this in DB
    const query = { "gridsquare": this.gridsquare, "realm_id": realm_id }
    console.log(`Unlinking note ${noteid.toHexString()}`)
    const update = { $set: { writer: app.sessionguid} , $pull: { notes: noteid } }
    const rval = await this.surveyresultscollection.updateOne(query, update)
    
  }


  getNote() {
    return this.notes.map(a => a.text).join("\n")
  }

  //We split the note to an array of lines
  //To reduce conflict where two people are editing at one time
  //As the smallest change we can apply is a single data item
  async updateNote(allText, inputType, offset) {

    //Compute what line has changed and update it
    var lines = allText.split('\n')
    var currentLine = 0
    var charCount = lines[0].length + 1

    while (charCount <= offset && currentLine < (lines.length - 1)) {
      currentLine = currentLine + 1
      charCount = charCount + lines[currentLine].length + 1
    }

    if (inputType == "insertLineBreak") currentLine--;//Cursor has moved on

    //console.log(`${currentLine} ${inputType} ${offset}`)
    //Typing
    if (this.notes.length == 0) {
       this.addNoteLine(lines[currentLine])
    } else {
       this.updateNoteLine(lines[currentLine], currentLine)
    }

    //Newlines
    if (inputType == "insertLineBreak") {
      if (currentLine == lines.length - 1) {
         this.addNoteLine("", currentLine + 1)

      } else {
         this.addNoteLine(lines[currentLine + 1], currentLine + 1)
      }
    }

    //Delete newlines
    if (inputType == "deleteContentBackward"
      && lines.length < this.notes.length) {
       this.deleteNoteLine(currentLine + 1) //Delete
    }
  }



  getIcon(type) {
    if (type == "carnivores") return "🦖"
    if (type == "herbivores") return "🦕"
    if (type == "visitors") return "🧍"
    else return "❓"
  }

  getOffsets(type) {
    if (type == "carnivores") return [1, 1]
    if (type == "herbivores") return [6.25, 1]
    if (type == "visitors") return [4.25, 6.25]
    else return [0, 0]
  }


}
