plugins {
    id("application")
}

val gdxVersion = "1.14.2"

sourceCompatibility = JavaVersion.VERSION_17
targetCompatibility = JavaVersion.VERSION_17

dependencies {
    implementation("com.badlogicgames.gdx:gdx:$gdxVersion")
    implementation("com.badlogicgames.gdx:gdx-backend-headless:$gdxVersion")
    implementation("com.badlogicgames.gdx:gdx-platform:$gdxVersion:natives-desktop")
}

application {
    mainClass.set("com.quadtree.broadphase.HeadlessLauncher")
}

tasks.named<JavaExec>("run") {
    standardInput = System.`in`
    // Forward args passed via --args to the application.
}
