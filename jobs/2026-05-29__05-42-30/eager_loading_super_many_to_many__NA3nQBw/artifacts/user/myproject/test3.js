const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

const Student = sequelize.define('Student', {
  name: DataTypes.STRING,
});

const Course = sequelize.define('Course', {
  title: DataTypes.STRING,
});

const Semester = sequelize.define('Semester', {
  name: DataTypes.STRING,
});

const Enrollment = sequelize.define('Enrollment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
});

Student.belongsToMany(Course, { through: Enrollment });
Course.belongsToMany(Student, { through: Enrollment });
Student.hasMany(Enrollment);
Enrollment.belongsTo(Student);
Course.hasMany(Enrollment);
Enrollment.belongsTo(Course);
Semester.hasMany(Enrollment);
Enrollment.belongsTo(Semester);

async function run() {
  await sequelize.sync({ force: true });

  const alice = await Student.create({ name: 'Alice' });
  const math = await Course.create({ title: 'Math 101' });
  const fall = await Semester.create({ name: 'Fall 2023' });

  await Enrollment.create({
    StudentId: alice.id,
    CourseId: math.id,
    SemesterId: fall.id,
  });

  const student = await Student.findOne({
    where: { name: 'Alice' },
    include: [
      {
        model: Course,
      },
      {
        model: Enrollment,
        include: [Semester]
      }
    ]
  });

  // Let's format it to match the criteria: "within each course's junction object (representing the enrollment), the corresponding Semester object."
  const json = student.toJSON();
  json.Courses.forEach(course => {
    const enrollment = json.Enrollments.find(e => e.CourseId === course.id);
    if (enrollment) {
      course.Enrollment.Semester = enrollment.Semester;
    }
  });
  delete json.Enrollments;

  console.log(JSON.stringify(json, null, 2));
}

run();
