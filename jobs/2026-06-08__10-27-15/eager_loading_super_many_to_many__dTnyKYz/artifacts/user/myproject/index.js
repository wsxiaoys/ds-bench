const { Sequelize, DataTypes } = require('sequelize');

// Set up an in-memory SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
});

// ─── Model Definitions ────────────────────────────────────────────────────────

const Student = sequelize.define('Student', {
  name: { type: DataTypes.STRING, allowNull: false },
});

const Course = sequelize.define('Course', {
  title: { type: DataTypes.STRING, allowNull: false },
});

// Explicit junction model – owns StudentId, CourseId, and SemesterId
const Enrollment = sequelize.define('Enrollment', {});

const Semester = sequelize.define('Semester', {
  name: { type: DataTypes.STRING, allowNull: false },
});

// ─── Associations ─────────────────────────────────────────────────────────────

// Many-to-Many through the explicit junction model
Student.belongsToMany(Course, { through: Enrollment });
Course.belongsToMany(Student, { through: Enrollment });

// Super Many-to-Many: direct One-to-Many associations on the junction model
// These are required so that Sequelize can eager-load Semester via Enrollment
Student.hasMany(Enrollment);
Enrollment.belongsTo(Student);

Course.hasMany(Enrollment);
Enrollment.belongsTo(Course);

// Enrollment belongs to a Semester
Enrollment.belongsTo(Semester);
Semester.hasMany(Enrollment);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Create all tables
  await sequelize.sync({ force: true });

  // Seed data
  const alice = await Student.create({ name: 'Alice' });

  const math    = await Course.create({ title: 'Math 101' });
  const history = await Course.create({ title: 'History 101' });

  const fall2023   = await Semester.create({ name: 'Fall 2023' });
  const spring2024 = await Semester.create({ name: 'Spring 2024' });

  // Enroll Alice in Math 101 for Fall 2023
  await Enrollment.create({
    StudentId:  alice.id,
    CourseId:   math.id,
    SemesterId: fall2023.id,
  });

  // Enroll Alice in History 101 for Spring 2024
  await Enrollment.create({
    StudentId:  alice.id,
    CourseId:   history.id,
    SemesterId: spring2024.id,
  });

  // ─── Query ───────────────────────────────────────────────────────────────────
  // Fetch Alice with her Courses.
  // Because of the Super Many-to-Many setup, we can also include Enrollment
  // (which in turn includes Semester) as a nested association on Course.
  const student = await Student.findOne({
    where: { name: 'Alice' },
    include: [
      {
        model: Course,
        include: [
          {
            model: Enrollment,
            include: [{ model: Semester }],
          },
        ],
      },
    ],
  });

  console.log(JSON.stringify(student, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
