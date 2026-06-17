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
  const history = await Course.create({ title: 'History 101' });
  const fall = await Semester.create({ name: 'Fall 2023' });
  const spring = await Semester.create({ name: 'Spring 2024' });

  await Enrollment.create({
    StudentId: alice.id,
    CourseId: math.id,
    SemesterId: fall.id,
  });

  await Enrollment.create({
    StudentId: alice.id,
    CourseId: history.id,
    SemesterId: spring.id,
  });

  const student = await Student.findOne({
    where: { name: 'Alice' },
    include: [
      {
        model: Course,
        include: [
          {
            model: Enrollment,
            include: [Semester]
          }
        ]
      }
    ]
  });

  const json = student.toJSON();
  json.Courses.forEach(course => {
    // Find the enrollment for THIS student
    const enrollment = course.Enrollments.find(e => e.StudentId === json.id);
    if (enrollment) {
      course.Enrollment.Semester = enrollment.Semester;
    }
    delete course.Enrollments;
  });

  console.log(JSON.stringify(json, null, 2));
}

run();
