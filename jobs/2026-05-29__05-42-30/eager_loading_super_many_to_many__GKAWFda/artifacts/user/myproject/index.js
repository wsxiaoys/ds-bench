const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: false,
});

const Student = sequelize.define('Student', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Course = sequelize.define('Course', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Semester = sequelize.define('Semester', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Enrollment = sequelize.define('Enrollment', {}, { timestamps: false });

Student.belongsToMany(Course, { through: Enrollment });
Course.belongsToMany(Student, { through: Enrollment });

Student.hasMany(Enrollment);
Enrollment.belongsTo(Student);

Course.hasMany(Enrollment);
Enrollment.belongsTo(Course);

Semester.hasMany(Enrollment);
Enrollment.belongsTo(Semester);

async function main() {
  await sequelize.sync({ force: true });

  const [alice] = await Student.bulkCreate([{ name: 'Alice' }], { returning: true });
  const [math, history] = await Course.bulkCreate(
    [{ title: 'Math 101' }, { title: 'History 101' }],
    { returning: true },
  );
  const [fall, spring] = await Semester.bulkCreate(
    [{ name: 'Fall 2023' }, { name: 'Spring 2024' }],
    { returning: true },
  );

  await Enrollment.bulkCreate([
    { StudentId: alice.id, CourseId: math.id, SemesterId: fall.id },
    { StudentId: alice.id, CourseId: history.id, SemesterId: spring.id },
  ]);

  const student = await Student.findOne({
    where: { name: 'Alice' },
    include: [
      {
        model: Course,
        include: [
          {
            model: Enrollment,
            where: { StudentId: sequelize.col('Student.id') },
            required: false,
            include: [Semester],
          },
        ],
      },
    ],
  });

  console.log(JSON.stringify(student, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
