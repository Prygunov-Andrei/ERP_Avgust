import RatingHeader from './_components/RatingHeader';
import ComingSoon from './_components/ComingSoon';

export default function RatingHomePage() {
  return (
    <>
      <RatingHeader />
      <ComingSoon
        title="Рейтинг кондиционеров"
        phase="Фаза 6A"
        designRef="ac-rating/design/wf-listing.jsx — RatingListA"
        description="Главная страница рейтинга с hero, фильтрами и листингом моделей. Сейчас — скелет навигации F0."
      />
    </>
  );
}
