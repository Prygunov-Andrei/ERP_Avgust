import RatingHeader from '../_components/RatingHeader';
import ComingSoon from '../_components/ComingSoon';

export default function RatingMethodologyPage() {
  return (
    <>
      <RatingHeader />
      <ComingSoon
        title="Методика рейтинга"
        phase="Фаза 6C"
        designRef="ac-rating/design/wf-screens.jsx — Methodology"
        description="Описание критериев и весов. Читает /api/public/v1/rating/methodology/."
      />
    </>
  );
}
