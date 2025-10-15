import { Provider } from 'react-redux';
import { store } from './store/store';
import { StreetViewCanvas } from './components/StreetViewCanvas';

function App() {
  return (
    <Provider store={store}>
      <div className="w-full h-screen overflow-hidden">
        <StreetViewCanvas />
      </div>
    </Provider>
  );
}

export default App;
