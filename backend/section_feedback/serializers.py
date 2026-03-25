from rest_framework import serializers
from django.contrib.auth.models import User

from .models import SectionFeedback, FeedbackReply, FeedbackAttachment


class FeedbackAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = FeedbackAttachment
        fields = ['id', 'url', 'original_filename', 'created_at']

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class FeedbackReplySerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    attachments = FeedbackAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = FeedbackReply
        fields = [
            'id', 'feedback', 'author', 'author_name',
            'text', 'attachments', 'created_at',
        ]
        read_only_fields = ['id', 'author', 'feedback', 'created_at']

    def get_author_name(self, obj):
        u = obj.author
        return u.get_full_name() or u.username


class FeedbackReplyCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackReply
        fields = ['text']


class SectionFeedbackListSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    reply_count = serializers.SerializerMethodField()
    attachment_count = serializers.SerializerMethodField()
    has_attachments = serializers.SerializerMethodField()

    class Meta:
        model = SectionFeedback
        fields = [
            'id', 'section', 'author', 'author_name',
            'text', 'status', 'reply_count', 'attachment_count',
            'has_attachments', 'created_at', 'updated_at',
        ]

    def get_author_name(self, obj):
        u = obj.author
        return u.get_full_name() or u.username

    def get_reply_count(self, obj):
        return getattr(obj, '_reply_count', obj.replies.count())

    def get_attachment_count(self, obj):
        return getattr(obj, '_attachment_count', obj.attachments.count())

    def get_has_attachments(self, obj):
        return self.get_attachment_count(obj) > 0


class SectionFeedbackDetailSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    attachments = FeedbackAttachmentSerializer(many=True, read_only=True)
    replies = FeedbackReplySerializer(many=True, read_only=True)
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = SectionFeedback
        fields = [
            'id', 'section', 'author', 'author_name',
            'text', 'status', 'attachments', 'replies',
            'reply_count', 'created_at', 'updated_at',
        ]

    def get_author_name(self, obj):
        u = obj.author
        return u.get_full_name() or u.username

    def get_reply_count(self, obj):
        return obj.replies.count()


class SectionFeedbackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionFeedback
        fields = ['id', 'section', 'text']
        read_only_fields = ['id']


class SectionFeedbackStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = SectionFeedback
        fields = ['status']
