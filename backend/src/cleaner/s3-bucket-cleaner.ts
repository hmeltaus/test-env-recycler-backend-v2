import { Bucket, paginateListObjectsV2, S3 } from "@aws-sdk/client-s3"
import { AwsCleaner, CleanResult } from "./aws-cleaner"

export class S3BucketCleaner extends AwsCleaner<S3, Bucket> {
  static readonly resourceType = "S3Bucket"
  readonly resourceType = S3BucketCleaner.resourceType
  readonly depends = []

  constructor(regions: string[]) {
    super((props) => new S3(props), regions)
  }

  protected getResourcesToClean = async (
    client: S3,
    region: string,
  ): Promise<Bucket[]> =>
    client
      .listBuckets({})
      .then((response) => response.Buckets!)
      .then(async (buckets) => {
        console.log(`Found ${buckets.length} buckets from region ${region}`)
        buckets.forEach((b) => console.log(b.Name))

        const bucketsWithData = await Promise.all(
          buckets.map(async (bucket) => {
            const { LocationConstraint: location } = await client
              .getBucketLocation({
                Bucket: bucket.Name,
              })
              .catch((e) => {
                console.log("Error when getting bucket", e)
                return { LocationConstraint: undefined }
              })

            if (!location) {
              return {
                bucket,
                include: false,
              }
            }

            console.log(`Bucket '${bucket.Name}' location: ${location}`)

            const bucketRegion = location ?? "us-east-1"
            if (bucketRegion !== region) {
              return {
                bucket,
                include: false,
              }
            }

            const tagSet = await client.getBucketTagging({
              Bucket: bucket.Name,
            })

            console.log(
              `Bucket '${bucket.Name}' tagging:`,
              JSON.stringify(tagSet, undefined, 2),
            )

            const include = tagSet.TagSet!.some(
              (t) => t.Key === "test-resource" && t.Value === "true",
            )

            return { bucket, include }
          }),
        )

        return bucketsWithData.filter((b) => b.include).map((b) => b.bucket)
      })

  protected cleanResource = async (
    client: S3,
    resource: Bucket,
  ): Promise<CleanResult> => {
    await this.paginate(
      paginateListObjectsV2({ client }, { Bucket: resource.Name }),
      (res) => res.Contents!.map((o) => o.Key!),
    ).then(async (objects) => {
      console.log(
        `Delete ${objects.length} objects from bucket ${resource.Name}`,
      )
      const keys = objects.map((key) => ({ Key: key }))
      await client.deleteObjects({
        Bucket: resource.Name,
        Delete: {
          Objects: keys,
        },
      })
    })

    return client
      .deleteBucket({ Bucket: resource.Name })
      .then(() => ({ id: resource.Name!, status: "success" }))
  }
}
