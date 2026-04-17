import { LandingHero } from './components/LandingHero'
import { ChatWidget } from './widgets/chat/ChatWidget'

export default function App() {
  return (
    <div className="relative min-h-dvh w-full">
      <LandingHero />
      <ChatWidget />
    </div>
  )
}
