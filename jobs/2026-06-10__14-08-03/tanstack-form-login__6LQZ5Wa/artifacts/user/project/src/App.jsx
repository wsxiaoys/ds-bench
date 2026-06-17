import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';

function App() {
  const [successMessage, setSuccessMessage] = useState('');

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setSuccessMessage('Login successful');
    },
  });

  return (
    <div>
      <h1>Login</h1>
      {successMessage && <div style={{ color: 'green' }}>{successMessage}</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div>
          <form.Field
            name="email"
            validators={{
              onChange: z.string().email('Invalid email address'),
            }}
            children={(field) => {
              return (
                <>
                  <label htmlFor={field.name}>Email:</label>
                  <input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors ? (
                    <em role="alert" style={{ color: 'red' }}>{field.state.meta.errors.join(', ')}</em>
                  ) : null}
                </>
              );
            }}
          />
        </div>
        <div>
          <form.Field
            name="password"
            validators={{
              onChange: z.string().min(8, 'Password must be at least 8 characters long'),
            }}
            children={(field) => {
              return (
                <>
                  <label htmlFor={field.name}>Password:</label>
                  <input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors ? (
                    <em role="alert" style={{ color: 'red' }}>{field.state.meta.errors.join(', ')}</em>
                  ) : null}
                </>
              );
            }}
          />
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default App;
