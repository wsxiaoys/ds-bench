const { Sequelize, DataTypes } = require('sequelize');

async function run() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false
  });

  // Define models
  const Student = sequelize.define('Student', {
    name: DataTypes.STRING
  }, { timestamps: false });

  const Course = sequelize.define('Course', {
    title: DataTypes.STRING
  }, { timestamps: false });

  const Semester = sequelize.define('Semester', {
    name: DataTypes.STRING
  }, { timestamps: false });

  const Enrollment = sequelize.define('Enrollment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    }
  }, { timestamps: false });

  // Set up Super Many-to-Many relationship
  // 1. Many-to-Many through Enrollment
  Student.belongsToMany(Course, { through: Enrollment });
  Course.belongsToMany(Student, { through: Enrollment });

  // 2. One-to-Many associations to enable eager loading on the junction model
  Student.hasMany(Enrollment);
  Enrollment.belongsTo(Student);
  Course.hasMany(Enrollment);
  Enrollment.belongsTo(Course);

  // 3. Association between Enrollment and Semester
  Enrollment.belongsTo(Semester);
  Semester.hasMany(Enrollment);

  // Sync database
  await sequelize.sync({ force: true });

  // Insert test data
  const alice = await Student.create({ name: 'Alice' });
  const math = await Course.create({ title: 'Math 101' });
  const history = await Course.create({ title: 'History 101' });
  const fall = await Semester.create({ name: 'Fall 2023' });
  const spring = await Semester.create({ name: 'Spring 2024' });

  // Alice is enrolled in "Math 101" for "Fall 2023"
  await Enrollment.create({ 
    StudentId: alice.id, 
    CourseId: math.id, 
    SemesterId: fall.id 
  });

  // Alice is enrolled in "History 101" for "Spring 2024"
  await Enrollment.create({ 
    StudentId: alice.id, 
    CourseId: history.id, 
    SemesterId: spring.id 
  });

  // Query: Fetch Student "Alice", including her Courses and their Semester info via Enrollment
  const student = await Student.findOne({
    where: { name: 'Alice' },
    include: [
      {
        model: Course,
        // We include the Enrollment model as a direct association of Course
        // to access its Semester association.
        include: [
          {
            model: Enrollment,
            include: [Semester],
            // We filter the enrollments to only include the one for this student
            where: { StudentId: alice.id }
          }
        ]
      }
    ]
  });

  // Output the result as JSON
  console.log(JSON.stringify(student, null, 2));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
