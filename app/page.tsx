
import HomeClient from "./components/HomeClient";
import RecentlyAdded from "./components/RecentlyAdded";

export default function HomePage() {
  return (
    <HomeClient
      recentlyAdded={<RecentlyAdded />}
    />
  );
}
