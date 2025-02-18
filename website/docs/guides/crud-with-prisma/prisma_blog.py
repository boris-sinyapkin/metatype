from typegraph import typegraph, Policy, t, Graph
from typegraph.providers.prisma import PrismaRuntime


@typegraph()
def blog(g: Graph):
    db = PrismaRuntime("blog", "POSTGRES")

    users = t.struct(
        {
            "id": t.integer(as_id=True),
            "name": t.string(),
            "posts": t.list(g.ref("Post")),
            "profile": g.ref("Profile").optional(),
        },
        name="User",
    )

    _profiles = t.struct(
        {
            "id": t.integer(as_id=True),
            "profilePic": t.string(),
            "user": g.ref("User"),
        },
        name="Profile",
    )

    posts = t.struct(
        {
            "id": t.integer(as_id=True),
            "content": t.string(),
            "author": g.ref("User"),
        },
        name="Post",
    )

    public = Policy.public()

    g.expose(
        createUser=db.create(users).with_policy(public),
        findUniqueUser=db.find_unique(users).with_policy(public),
        findManyUsers=db.find_many(users).with_policy(public),
        updateUser=db.update(users).with_policy(public),
        deleteUser=db.delete(users).with_policy(public),
        createPost=db.create(posts).with_policy(public),
        findUniquePost=db.find_unique(posts).with_policy(public),
        findManyPosts=db.find_many(posts).with_policy(public),
    )
