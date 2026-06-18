import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const runId = import.meta.env.VITE_RUN_ID;
  const count = useQuery(api.counter.get, { runId }) || 0;
  const increment = useMutation(api.counter.increment);

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <h2>Count is {count}</h2>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => increment({ runId })}
        >
          Increment
        </button>
      </section>
    </>
  )
}

export default App
