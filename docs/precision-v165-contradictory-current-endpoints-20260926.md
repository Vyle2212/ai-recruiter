# Precision v165: contradictory current endpoints

The shared calendar helper previously returned the present month whenever a
structured `current` flag was true, even if the same employment or project row
printed a dated endpoint in the past. That conflict could qualify an invalid
row and inflate calculated tenure.

The date helper now refuses a dated endpoint when `current` is true. A missing
endpoint with an explicit current flag remains supported; so does an explicit
current endpoint. The abbreviated `Curr` marker is recognized consistently by
the shared date grammar and month validator. Reversed, future and invalid
calendar dates remain rejected.

Regression checks cover the direct calendar calculation and both employment
and project qualification. Admin and candidate CV uploads use these shared
rules. No production row, Storage object or profile was changed. A full-file
audit and source review remain necessary; synthetic tests do not prove field
accuracy across the original CV collection.
