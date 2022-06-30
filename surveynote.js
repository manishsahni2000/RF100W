
class SurveyNote {

  constructor(txt) {
    const mongodb = realmApp.currentUser.mongoClient("mongodb-atlas");
    const dinodb  = mongodb.db("dino")
    this.surveynotescollection = dinodb.collection("SurveyNote");
    this.id = new Realm.BSON.ObjectId(); 
    this.text = txt
    this.date = new Date()
  }

  affectedBy(change)
  {
    if(this.id.toHexString() == change.documentKey._id) {
      return true;
    }
    return false;
  }

  async addToDatabase()
  {
    const record = { 
      _id : this.id,
       writer: app.sessionguid,
       text : this.text,
           date: this.date,
           realm_id: realm_id  }
  
    let result = await this.surveynotescollection.insertOne(record )
    this.id = result.insertedId;
  }

  async retrieveFromDatabase(noteid)
  {
    const query = { _id : noteid }
    try {
    let rec = await  this.surveynotescollection.findOne( query)
    if(rec == null) return false;
    this.text = rec.text;
    this.id = rec._id;
    this.data = rec.date;
    }
    catch(err) {
      showError(err);
      return false;
    }
    return true;
  }

  async removeFromDatabase()
  {
    const query = { _id : this.id }
    this.surveynotescollection.deleteOne( query)
  }

  async setText(txt) {
    this.text = txt;
    const query = { _id : this.id }
    const update = { $set : { text : txt,  writer: app.sessionguid }}
    
    
    this.surveynotescollection.updateOne( query,update)
  }
  
}
