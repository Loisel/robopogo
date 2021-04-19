# Generated by Django 3.2 on 2021-04-19 21:15

import django.contrib.postgres.fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('roboserv', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='game',
            name='countdown_started',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='game',
            name='player_choices',
            field=django.contrib.postgres.fields.ArrayField(base_field=models.CharField(blank=True, max_length=10), null=True, size=None),
        ),
        migrations.AlterField(
            model_name='game',
            name='player_moves',
            field=django.contrib.postgres.fields.ArrayField(base_field=models.CharField(blank=True, max_length=5), null=True, size=None),
        ),
        migrations.AlterField(
            model_name='game',
            name='player_pos',
            field=django.contrib.postgres.fields.ArrayField(base_field=django.contrib.postgres.fields.ArrayField(base_field=models.PositiveSmallIntegerField(), size=2), null=True, size=None),
        ),
    ]
