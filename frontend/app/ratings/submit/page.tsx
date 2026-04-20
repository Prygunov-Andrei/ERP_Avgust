import RatingHeader from '../_components/RatingHeader';
import ComingSoon from '../_components/ComingSoon';

export default function RatingSubmitPage() {
  return (
    <>
      <RatingHeader />
      <ComingSoon
        title="Добавить модель в рейтинг"
        phase="Фаза 6C"
        designRef="ac-rating/design/wf-screens.jsx — SubmitForm"
        description="Форма заявки (FormData с фото, honeypot, ratelimit 3/ч). POST /api/public/v1/rating/submissions/."
      />
    </>
  );
}
