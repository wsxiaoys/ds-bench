package com.example;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

/**
 * A thin {@link HeadlessApplication} subclass that exposes the internal
 * main-loop thread so the bootstrapping {@code main} method can {@code join()}
 * it and guarantee that {@code dispose()} (which flushes the output file) has
 * fully completed before the JVM terminates.
 */
public class JoinableHeadlessApplication extends HeadlessApplication {

    public JoinableHeadlessApplication(ApplicationListener listener, HeadlessApplicationConfiguration config) {
        super(listener, config);
    }

    /**
     * Block the calling thread until the libGDX main-loop thread terminates.
     * The main loop terminates once {@link com.badlogic.gdx.Application#exit()}
     * has been processed, which in turn invokes {@code pause()} and
     * {@code dispose()} on the listener.
     */
    public void awaitStop() throws InterruptedException {
        // mainLoopThread is a protected field on HeadlessApplication.
        mainLoopThread.join();
    }
}