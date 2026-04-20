import RatingHeader from '../_components/RatingHeader';
import ComingSoon from '../_components/ComingSoon';

export default function RatingArchivePage() {
  return (
    <>
      <RatingHeader />
      <ComingSoon
        title="Архив моделей"
        phase="Фаза 6C"
        designRef="ac-rating/design/wf-screens.jsx — Archive"
        description="Снятые с производства или устаревшие модели. GET /api/public/v1/rating/models/archive/."
      />
    </>
  );
}
